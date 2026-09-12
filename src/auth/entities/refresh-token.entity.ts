import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ })
  userId: string;

  @Column({ })
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt: Date;

  @CreateDateColumn({ })
  createdAt: Date;

  @ManyToOne(() => User, (user) => (user as any).refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ })
  user: User;
}
