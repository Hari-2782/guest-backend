import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Offer } from '../../offers/entities/offer.entity';

export enum BookingStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'booking_number', unique: true, nullable: false })
  bookingNumber: string;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Index()
  @Column({ name: 'room_id', nullable: false })
  roomId: string;

  @Column({ name: 'customer_first_name', nullable: true })
  customerFirstName: string;

  @Column({ name: 'customer_last_name', nullable: true })
  customerLastName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ name: 'customer_address', nullable: true })
  customerAddress: string;

  @Column({ name: 'customer_email', nullable: true })
  customerEmail: string;

  @Index()
  @Column({ name: 'check_in_date', type: 'date', nullable: false })
  checkInDate: Date;

  @Index()
  @Column({ name: 'check_out_date', type: 'date', nullable: false })
  checkOutDate: Date;

  @Column({ name: 'number_of_guests', type: 'int', nullable: false })
  numberOfGuests: number;

  @Column({ name: 'number_of_adults', type: 'int', nullable: false })
  numberOfAdults: number;

  @Column({ name: 'number_of_children', type: 'int', default: 0 })
  numberOfChildren: number;

  @Column({ name: 'number_of_nights', type: 'int', nullable: false })
  numberOfNights: number;

  @Column({ name: 'price_per_night', type: 'decimal', precision: 10, scale: 2, nullable: false })
  pricePerNight: number;

  @Column({ name: 'is_ac', default: true })
  isAc: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, nullable: false })
  totalAmount: number;

  @Column({ name: 'offer_id', nullable: true })
  offerId: string;

  @Index()
  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ name: 'customer_note', type: 'text', nullable: true })
  customerNote: string;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room, (room) => room.bookings)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Offer, (offer) => offer.bookings, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @ManyToOne(() => User, (user) => user.approvedBookings, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: User;
}
