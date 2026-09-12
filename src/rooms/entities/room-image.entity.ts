import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';

@Entity('room_images')
export class RoomImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ })
  roomId: string;

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ nullable: true })
  publicId: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ })
  createdAt: Date;

  @ManyToOne(() => Room, (room) => (room as any).images, { onDelete: 'CASCADE' })
  @JoinColumn({ })
  room: Room;
}
