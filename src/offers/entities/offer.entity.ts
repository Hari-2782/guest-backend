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
    name: 'discount_type',
  })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2, nullable: false })
  discountValue: number;

  @Index()
  @Column({ name: 'start_date', type: 'datetime', nullable: false })
  startDate: Date;

  @Index()
  @Column({ name: 'end_date', type: 'datetime', nullable: false })
  endDate: Date;

  @Column({ name: 'days_of_week', type: 'varchar', length: 100, nullable: true })
  daysOfWeek: string;

  @Column({ name: 'minimum_nights', type: 'int', default: 1 })
  minimumNights: number;

  @Index()
  @Column({ name: 'room_type_id', nullable: true })
  roomTypeId: string;

  @Index()
  @Column({ name: 'room_id', nullable: true })
  roomId: string;

  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'banner_image', type: 'text', nullable: true })
  bannerImage: string;

  @Column({ name: 'icon_name', type: 'varchar', length: 50, nullable: true })
  iconName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => RoomType, (roomType) => roomType.offers, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @ManyToOne(() => Room, (room) => room.offers, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => Booking, (booking) => booking.offer)
  bookings: Booking[];
}
