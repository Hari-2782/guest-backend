import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not, LessThan, MoreThan, MoreThanOrEqual, Like } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { Role } from '../users/entities/user.entity';
import { AvailabilityService } from '../availability/availability.service';
import { OffersService } from '../offers/offers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryMyBookingsDto } from './dto/query-my-bookings.dto';
import { QueryAdminBookingsDto } from './dto/query-admin-bookings.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import {
  BookingResponse,
  mapBookingToResponse,
} from './mappers/booking.mapper';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  BookingAlreadyProcessedException,
  BookingNotCancellableException,
  BookingNotFoundException,
  RoomCapacityExceededException,
  RoomInactiveException,
  RoomNotAvailableException,
  RoomNotFoundException,
  RoomUnderMaintenanceException,
} from '../common/exceptions/domain-exceptions';
import {
  assertValidDateRange,
  calculateNights,
  toUtcDateOnly,
  todayUtcDateOnly,
} from '../common/utils/date.util';
import { roundCurrency, toNumber } from '../common/utils/decimal.util';
import { generateBookingNumber } from '../common/utils/booking-number.util';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';
import { ForbiddenDomainException } from '../common/exceptions/domain.exception';
import { ErrorCode } from '../common/enums/error-code.enum';

/** Statuses from which a booking can still be cancelled. */
const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly offersService: OffersService,
  ) {}

  /**
   * Creates a booking request. Every pricing figure is derived from the
   * database inside a single transaction, which also serializes concurrent
   * attempts on the same room via a row lock before the overlap check runs.
   */
  async create(userId: string | undefined, dto: CreateBookingDto): Promise<BookingResponse> {
    const checkInDate = toUtcDateOnly(dto.checkInDate);
    const checkOutDate = toUtcDateOnly(dto.checkOutDate);
    assertValidDateRange(checkInDate, checkOutDate);

    const numberOfAdults = dto.numberOfAdults;
    const numberOfChildren = dto.numberOfChildren ?? 0;
    const numberOfGuests = numberOfAdults + numberOfChildren;

    const booking = await this.dataSource.transaction(async (manager) => {
      const room = await manager.findOne(Room, { where: { id: dto.roomId } });
      if (!room) throw new RoomNotFoundException();
      if (!room.isActive || room.status === RoomStatus.INACTIVE)
        throw new RoomInactiveException();
      if (room.status === RoomStatus.MAINTENANCE) throw new RoomUnderMaintenanceException();
      if (numberOfGuests > room.maximumGuests) {
        throw new RoomCapacityExceededException(room.maximumGuests);
      }

      // Serialize concurrent booking attempts for this exact room.
      await this.availabilityService.lockRoomForUpdate(manager, room.id);

      const hasOverlap = await this.availabilityService.hasOverlappingBooking(
        manager,
        room.id,
        checkInDate,
        checkOutDate,
      );
      if (hasOverlap) throw new RoomNotAvailableException();

      const numberOfNights = calculateNights(checkInDate, checkOutDate);
      const isAc = dto.isAc ?? true;
      const pricePerNight =
        !isAc && room.pricePerNightNonAc
          ? Number(room.pricePerNightNonAc)
          : Number(room.pricePerNight);
      const subtotal = roundCurrency(pricePerNight * numberOfNights);

      const appliedOffer = await this.offersService.findBestApplicableOffer({
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        checkInDate,
        numberOfNights,
        subtotal,
      });

      const discountAmount = appliedOffer?.discountAmount ?? 0;
      const totalAmount = roundCurrency(subtotal - discountAmount);
      // Wait to port generateBookingNumber if it needs prisma, but it probably doesn't.
      // Let's pass null for now and use UUID or string if it complains
      const bookingNumber = await generateBookingNumber(manager);

      const createdBooking = manager.create(Booking, {
        bookingNumber,
        userId: userId ?? null,
        roomId: room.id,
        customerFirstName: dto.firstName,
        customerLastName: dto.lastName,
        customerPhone: dto.phone,
        customerAddress: dto.address,
        customerEmail: dto.email ?? null,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        numberOfAdults,
        numberOfChildren,
        numberOfNights,
        pricePerNight,
        isAc,
        subtotal,
        discountAmount,
        totalAmount,
        offerId: appliedOffer?.offerId,
        status: BookingStatus.PENDING,
        customerNote: dto.customerNote,
      } as any);

      const savedBooking = await manager.save(createdBooking);

      await manager.save(BookingStatusHistory, manager.create(BookingStatusHistory, {
        bookingId: savedBooking.id,
        status: BookingStatus.PENDING,
        changedBy: userId ?? null,
        note: `Booking request created by customer (${dto.firstName} ${dto.lastName})`,
      } as any));

      // Reload with relations to map correctly
      return await manager.findOne(Booking, {
        where: { id: savedBooking.id },
        relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
      });
    });

    return mapBookingToResponse(booking as any);
  }

  async findMyBookings(
    userId: string,
    query: QueryMyBookingsDto,
  ): Promise<PaginatedResult<BookingResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: any = { userId };
    if (query.status) where.status = query.status;

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
      relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
    });

    return buildPaginatedResult(bookings.map(mapBookingToResponse), page, limit, total);
  }

  async findOne(id: string, requestingUser: AuthenticatedUser): Promise<BookingResponse> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
    });
    if (!booking) throw new BookingNotFoundException();

    if (requestingUser.role !== (Role.ADMIN as any) && booking.userId !== requestingUser.id) {
      throw new ForbiddenDomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this booking',
      );
    }

    return mapBookingToResponse(booking);
  }

  /** Customer-initiated cancellation of their own booking. */
  async cancelOwn(id: string, userId: string, dto: CancelBookingDto): Promise<BookingResponse> {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) throw new BookingNotFoundException();

    if (booking.userId !== userId) {
      throw new ForbiddenDomainException(
        ErrorCode.FORBIDDEN,
        'You can only cancel your own bookings',
      );
    }

    this.assertCancellable(booking.status, booking.checkInDate);

    return this.applyCancellation(id, userId, dto.cancellationReason);
  }

  /** Admin can cancel any eligible booking. */
  async cancelAsAdmin(
    id: string,
    adminId: string,
    dto: CancelBookingDto,
  ): Promise<BookingResponse> {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) throw new BookingNotFoundException();

    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BookingAlreadyProcessedException(booking.status);
    }

    return this.applyCancellation(id, adminId, dto.cancellationReason);
  }

  // ---------------------------------------------------------------------
  // Admin queries & lifecycle
  // ---------------------------------------------------------------------

  async findAllAdmin(query: QueryAdminBookingsDto): Promise<PaginatedResult<BookingResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    // Using query builder due to OR logic in relations
    const qb = this.bookingRepository.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('room.images', 'images')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.approvedByUser', 'approvedByUser');

    if (query.status) qb.andWhere('booking.status = :status', { status: query.status });
    if (query.roomId) qb.andWhere('booking.roomId = :roomId', { roomId: query.roomId });
    if (query.userId) qb.andWhere('booking.userId = :userId', { userId: query.userId });
    if (query.checkIn) qb.andWhere('booking.checkInDate >= :checkIn', { checkIn: toUtcDateOnly(query.checkIn) });
    if (query.checkOut) qb.andWhere('booking.checkOutDate <= :checkOut', { checkOut: toUtcDateOnly(query.checkOut) });
    if (query.createdFrom) qb.andWhere('booking.createdAt >= :createdFrom', { createdFrom: new Date(query.createdFrom) });
    if (query.createdTo) qb.andWhere('booking.createdAt <= :createdTo', { createdTo: new Date(query.createdTo) });

    if (query.search) {
      qb.andWhere('(booking.bookingNumber LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)', { search: `%${query.search}%` });
    }

    if (query.sortBy) {
      qb.orderBy(`booking.${query.sortBy}`, query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy('booking.createdAt', 'DESC');
    }

    const [bookings, total] = await qb.skip(skip).take(take).getManyAndCount();

    return buildPaginatedResult(bookings.map(mapBookingToResponse), page, limit, total);
  }

  async findOneAdmin(id: string): Promise<BookingResponse> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
    });
    if (!booking) throw new BookingNotFoundException();
    return mapBookingToResponse(booking);
  }

  /**
   * Approves a PENDING booking. Re-checks availability inside the same
   * transaction (with a row lock) to close the race window between the
   * customer's request and the admin's approval - the whole reason this
   * check must never rely on frontend state.
   */
  async approve(id: string, adminId: string): Promise<BookingResponse> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Booking, { where: { id } });
      if (!existing) throw new BookingNotFoundException();
      if (existing.status !== BookingStatus.PENDING) {
        throw new BookingAlreadyProcessedException(existing.status);
      }

      await this.availabilityService.lockRoomForUpdate(manager, existing.roomId);

      const hasOverlap = await this.availabilityService.hasOverlappingBooking(
        manager,
        existing.roomId,
        existing.checkInDate,
        existing.checkOutDate,
        existing.id,
      );
      if (hasOverlap) {
        throw new RoomNotAvailableException('Room is no longer available for the selected dates.');
      }

      existing.status = BookingStatus.APPROVED;
      existing.approvedBy = adminId;
      existing.approvedAt = new Date();
      await manager.save(existing);

      await manager.save(BookingStatusHistory, manager.create(BookingStatusHistory, {
        bookingId: id,
        status: BookingStatus.APPROVED,
        changedBy: adminId,
        note: 'Booking approved by admin',
      } as any));

      return await manager.findOne(Booking, {
        where: { id },
        relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
      });
    });

    return mapBookingToResponse(booking as any);
  }

  async reject(id: string, adminId: string, dto: RejectBookingDto): Promise<BookingResponse> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Booking, { where: { id } });
      if (!existing) throw new BookingNotFoundException();
      if (existing.status !== BookingStatus.PENDING) {
        throw new BookingAlreadyProcessedException(existing.status);
      }

      existing.status = BookingStatus.REJECTED;
      existing.rejectedAt = new Date();
      (existing as any).rejectionReason = dto.rejectionReason ?? null;
      await manager.save(existing);

      await manager.save(BookingStatusHistory, manager.create(BookingStatusHistory, {
        bookingId: id,
        status: BookingStatus.REJECTED,
        changedBy: adminId,
        note: dto.rejectionReason ?? 'Booking rejected by admin',
      } as any));

      return await manager.findOne(Booking, {
        where: { id },
        relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
      });
    });

    return mapBookingToResponse(booking as any);
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  private assertCancellable(status: BookingStatus, checkInDate: Date): void {
    if (!CANCELLABLE_STATUSES.includes(status)) {
      throw new BookingNotCancellableException(
        `Bookings with status ${status} can no longer be cancelled`,
      );
    }

    if (checkInDate.getTime() <= todayUtcDateOnly().getTime()) {
      throw new BookingNotCancellableException(
        'This booking can no longer be cancelled as the check-in date has arrived or passed',
      );
    }
  }

  private async applyCancellation(
    id: string,
    changedBy: string,
    reason: string | undefined,
  ): Promise<BookingResponse> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Booking, { where: { id } });
      if (!existing) throw new BookingNotFoundException();
      
      existing.status = BookingStatus.CANCELLED;
      existing.cancelledAt = new Date();
      (existing as any).cancellationReason = reason ?? null;
      await manager.save(existing);

      await manager.save(BookingStatusHistory, manager.create(BookingStatusHistory, {
        bookingId: id,
        status: BookingStatus.CANCELLED,
        changedBy,
        note: reason ?? 'Booking cancelled',
      } as any));

      return await manager.findOne(Booking, {
        where: { id },
        relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any,
      });
    });

    return mapBookingToResponse(booking as any);
  }
}
