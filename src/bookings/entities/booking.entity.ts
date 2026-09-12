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

  @Column({ unique: true, nullable: false })
  bookingNumber: string;

  @Index()
  @Column({ nullable: true })
  userId: string;

  @Index()
  @Column({ nullable: false })
  roomId: string;

  @Column({ nullable: true })
  customerFirstName: string;

  @Column({ nullable: true })
  customerLastName: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ nullable: true })
  customerAddress: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Index()
  @Column({ type: 'date', nullable: false })
  checkInDate: Date;

  @Index()
  @Column({ type: 'date', nullable: false })
  checkOutDate: Date;

  @Column({ type: 'int', nullable: false })
  numberOfGuests: number;

  @Column({ type: 'int', nullable: false })
  numberOfAdults: number;

  @Column({ type: 'int', default: 0 })
  numberOfChildren: number;

  @Column({ type: 'int', nullable: false })
  numberOfNights: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  pricePerNight: number;

  @Column({ default: true })
  isAc: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  totalAmount: number;

  @Column({ nullable: true })
  offerId: string;

  @Index()
  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  customerNote: string;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @CreateDateColumn({ })
  createdAt: Date;

  @UpdateDateColumn({ })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  user: User;

  @ManyToOne(() => Room, (room) => room.bookings)
  @JoinColumn({ })
  room: Room;

  @ManyToOne(() => Offer, (offer) => offer.bookings, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  offer: Offer;

  @ManyToOne(() => User, (user) => user.approvedBookings, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  approvedByUser: User;
}
