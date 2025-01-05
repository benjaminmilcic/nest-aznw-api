import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class FailedLogin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ip: string;

  @Column({ default: 0 })
  failedAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  blockedUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
