import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Analytics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sessionId: string; // UUID zur Verknüpfung mit PageViews

  // Frontend-Daten
  @Column({ type: 'datetime' })
  timestamp: Date;

  @Column({ type: 'text' })
  userAgent: string;

  @Column()
  language: string;

  @Column({ type: 'json' })
  languages: string[];

  @Column()
  platform: string;

  @Column({ type: 'json' })
  screenResolution: {
    width: number;
    height: number;
  };

  @Column({ type: 'json' })
  viewportSize: {
    width: number;
    height: number;
  };

  @Column()
  timezone: string;

  @Column()
  timezoneOffset: number;

  @Column()
  cookiesEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  referrer: string;

  @Column({ nullable: true })
  deviceMemory: number;

  @Column({ nullable: true })
  hardwareConcurrency: number;

  @Column({ nullable: true })
  connectionType: string;

  @Column()
  online: boolean;

  // Backend-spezifische Daten
  @Column({ nullable: true })
  ipAddressAnonymized: string; // Anonymisierte IP (letzte Oktette entfernt)

  @Column({ type: 'text', nullable: true })
  acceptLanguage: string; // Accept-Language Header

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date; // Zeitpunkt der Speicherung im Backend
}
