import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In, EntityManager, Not } from 'typeorm';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { mapRoomToResponse, RoomResponse } from '../rooms/mappers/room.mapper';
import { assertValidDateRange, toUtcDateOnly } from '../common/utils/date.util';
import { RoomNotFoundException } from '../common/exceptions/domain-exceptions';

/** Bookings in these statuses hold a claim on the room's calendar. */
const BLOCKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED];

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  /**
   * GET /availability - returns active, non-maintenance rooms that satisfy
   * the guest count and have no PENDING/APPROVED booking overlapping the
   * requested date range.
   */
  async searchAvailableRooms(query: AvailabilityQueryDto): Promise<RoomResponse[]> {
    const checkIn = toUtcDateOnly(query.checkIn);
    const checkOut = toUtcDateOnly(query.checkOut);
    assertValidDateRange(checkIn, checkOut);

    const where: any = {
      isActive: true,
      status: RoomStatus.AVAILABLE,
    };
    if (query.guests) where.maximumGuests = MoreThan(query.guests - 1);
    if (query.roomTypeId) where.roomTypeId = query.roomTypeId;

    const candidateRooms = await this.roomRepository.find({
      where,
      relations: { roomType: true, images: true, facilities: true },
    });

    if (candidateRooms.length === 0) return [];

    const overlappingRoomIds = await this.findOverlappingRoomIds(
      this.bookingRepository,
      candidateRooms.map((r) => r.id),
      checkIn,
      checkOut,
    );

    return candidateRooms.filter((room) => !overlappingRoomIds.has(room.id)).map(mapRoomToResponse);
  }

  /** GET /rooms/:id/availability response shape: { available: boolean } */
  async isRoomAvailableResponse(
    roomId: string,
    checkInStr: string,
    checkOutStr: string,
  ): Promise<{ available: boolean }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new RoomNotFoundException();

    const checkIn = toUtcDateOnly(checkInStr);
    const checkOut = toUtcDateOnly(checkOutStr);
    assertValidDateRange(checkIn, checkOut);

    if (!room.isActive || room.status !== RoomStatus.AVAILABLE) {
      return { available: false };
    }

    const hasOverlap = await this.hasOverlappingBooking(this.bookingRepository, roomId, checkIn, checkOut);
    return { available: !hasOverlap };
  }

  /**
   * Core overlap check, reused by booking creation and booking approval so
   * the exact same rule governs every path that can claim a room.
   * Accepts an EntityManager or Repository so it can run inside the same DB
   * transaction as the booking write it is guarding.
   */
  async hasOverlappingBooking(
    managerOrRepo: EntityManager | Repository<Booking>,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const repo = managerOrRepo instanceof EntityManager 
      ? managerOrRepo.getRepository(Booking) 
      : managerOrRepo;
      
    const count = await repo.count({
      where: {
        roomId,
        status: In(BLOCKING_STATUSES),
        ...(excludeBookingId ? { id: Not(excludeBookingId) } : {}),
        checkInDate: LessThan(checkOut),
        checkOutDate: MoreThan(checkIn),
      },
    });
    return count > 0;
  }

  /**
   * Locks the room row (SELECT ... FOR UPDATE) inside an active transaction
   * so concurrent booking attempts on the *same* room serialize instead of
   * racing past the overlap check together. This is the mechanism that
   * actually prevents double-booking under concurrency.
   */
  async lockRoomForUpdate(manager: EntityManager, roomId: string): Promise<void> {
    await manager.query(`SELECT id FROM rooms WHERE id = ? FOR UPDATE`, [roomId]);
  }

  private async findOverlappingRoomIds(
    repo: Repository<Booking>,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
  ): Promise<Set<string>> {
    const overlapping = await repo.find({
      where: {
        roomId: In(roomIds),
        status: In(BLOCKING_STATUSES),
        checkInDate: LessThan(checkOut),
        checkOutDate: MoreThan(checkIn),
      },
      select: { roomId: true },
    });
    return new Set(overlapping.map((b) => b.roomId));
  }
}
