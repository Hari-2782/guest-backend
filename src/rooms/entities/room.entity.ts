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
  @Column({ name: 'room_number', unique: true, nullable: false })
  roomNumber: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @Column({ name: 'room_type_id', nullable: false })
  roomTypeId: string;

  @Column({ name: 'price_per_night', type: 'decimal', precision: 10, scale: 2, nullable: false })
  pricePerNight: number;

  @Column({ name: 'price_per_night_non_ac', type: 'decimal', precision: 10, scale: 2, nullable: true })
  pricePerNightNonAc: number;

  @Column({ name: 'maximum_guests', type: 'int', nullable: false })
  maximumGuests: number;

  @Column({ name: 'number_of_beds', type: 'int', nullable: false })
  numberOfBeds: number;

  @Column({ name: 'number_of_bathrooms', type: 'int', default: 1 })
  numberOfBathrooms: number;

  @Column({ name: 'room_size', type: 'float', nullable: true })
  roomSize: number;

  @Index()
  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  status: RoomStatus;

  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => RoomType, (roomType) => roomType.rooms)
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @OneToMany(() => RoomImage, (image) => image.room, { cascade: true })
  images: RoomImage[];

  @ManyToMany(() => Facility, { cascade: true })
  @JoinTable({
    name: 'room_facilities',
    joinColumn: { name: 'room_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'facility_id', referencedColumnName: 'id' },
  })
  facilities: Facility[];

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];

  @OneToMany(() => Offer, (offer) => offer.room)
  offers: Offer[];
}
