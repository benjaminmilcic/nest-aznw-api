import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PageView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sessionId: string; // UUID zur Verknüpfung mit Analytics

  @Column()
  route: string; // z.B. "/about", "/contact"

  @Column({ type: 'datetime' })
  timestamp: Date;

  @Column({ type: 'text', nullable: true })
  referrer: string; // Vorherige Route (optional)

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date; // Zeitpunkt der Speicherung im Backend
}
