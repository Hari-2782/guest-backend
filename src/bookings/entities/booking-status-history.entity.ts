import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { User } from '../../users/entities/user.entity';

@Entity('booking_status_history')
export class BookingStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'changed_by', nullable: true })
  changedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Booking, (booking) => (booking as any).statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User;
}
