import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { User, Role } from '../users/entities/user.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { todayUtcDateOnly } from '../common/utils/date.util';

export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  maintenanceRooms: number;
  totalCustomers: number;
  pendingBookings: number;
  approvedBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  upcomingBookings: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const today = todayUtcDateOnly();

    const [
      totalRooms,
      availableRooms,
      maintenanceRooms,
      totalCustomers,
      pendingBookings,
      approvedBookings,
      todayCheckIns,
      todayCheckOuts,
      upcomingBookings,
    ] = await Promise.all([
      this.roomRepository.count(),
      this.roomRepository.count({ where: { isActive: true, status: RoomStatus.AVAILABLE } }),
      this.roomRepository.count({ where: { status: RoomStatus.MAINTENANCE } }),
      this.userRepository.count({ where: { role: Role.CUSTOMER as any } }),
      this.bookingRepository.count({ where: { status: BookingStatus.PENDING } }),
      this.bookingRepository.count({ where: { status: BookingStatus.APPROVED } }),
      this.bookingRepository.count({
        where: { status: BookingStatus.APPROVED, checkInDate: today },
      }),
      this.bookingRepository.count({
        where: { status: BookingStatus.APPROVED, checkOutDate: today },
      }),
      this.bookingRepository.count({
        where: { status: BookingStatus.APPROVED, checkInDate: MoreThan(today) },
      }),
    ]);

    return {
      totalRooms,
      availableRooms,
      maintenanceRooms,
      totalCustomers,
      pendingBookings,
      approvedBookings,
      todayCheckIns,
      todayCheckOuts,
      upcomingBookings,
    };
  }
}
