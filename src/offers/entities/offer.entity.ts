import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { RoomType } from '../../room-types/entities/room-type.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
  })
  discountType: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  discountValue: number;

  @Index()
  @Column({ type: 'datetime', nullable: false })
  startDate: Date;

  @Index()
  @Column({ type: 'datetime', nullable: false })
  endDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  daysOfWeek: string;

  @Column({ type: 'int', default: 1 })
  minimumNights: number;

  @Index()
  @Column({ nullable: true })
  roomTypeId: string;

  @Index()
  @Column({ nullable: true })
  roomId: string;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  bannerImage: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  iconName: string;

  @CreateDateColumn({ })
  createdAt: Date;

  @UpdateDateColumn({ })
  updatedAt: Date;

  @ManyToOne(() => RoomType, (roomType) => roomType.offers, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  roomType: RoomType;

  @ManyToOne(() => Room, (room) => room.offers, { onDelete: 'SET NULL' })
  @JoinColumn({ })
  room: Room;

  @OneToMany(() => Booking, (booking) => booking.offer)
  bookings: Booking[];
}
