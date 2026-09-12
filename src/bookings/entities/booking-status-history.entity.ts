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
  @Column({ })
  bookingId: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ nullable: true })
  changedBy: string;

  @CreateDateColumn({ })
  createdAt: Date;

  @ManyToOne(() => Booking, (booking) => (booking as any).statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ })
  booking: Booking;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  changedByUser: User;
}
