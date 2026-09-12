import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
  JoinColumn,
} from 'typeorm';
import { RoomType } from '../../room-types/entities/room-type.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { RoomImage } from './room-image.entity';
import { Facility } from '../../facilities/entities/facility.entity';

export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  MAINTENANCE = 'MAINTENANCE',
  OCCUPIED = 'OCCUPIED',
  INACTIVE = 'INACTIVE',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, nullable: false })
  roomNumber: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @Column({ nullable: false })
  roomTypeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  pricePerNight: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pricePerNightNonAc: number;

  @Column({ type: 'int', nullable: false })
  maximumGuests: number;

  @Column({ type: 'int', nullable: false })
  numberOfBeds: number;

  @Column({ type: 'int', default: 1 })
  numberOfBathrooms: number;

  @Column({ type: 'float', nullable: true })
  roomSize: number;

  @Index()
  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  status: RoomStatus;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ })
  createdAt: Date;

  @UpdateDateColumn({ })
  updatedAt: Date;

  @ManyToOne(() => RoomType, (roomType) => roomType.rooms)
  @JoinColumn({ })
  roomType: RoomType;

  @OneToMany(() => RoomImage, (image) => image.room, { cascade: true })
  images: RoomImage[];

  @ManyToMany(() => Facility, { cascade: true })
  @JoinTable({
    name: 'room_facilities',
    joinColumn: { referencedColumnName: 'id' },
    inverseJoinColumn: { referencedColumnName: 'id' },
  })
  facilities: Facility[];

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];

  @OneToMany(() => Offer, (offer) => offer.room)
  offers: Offer[];
}
