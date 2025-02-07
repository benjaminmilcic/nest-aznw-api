import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Moorhuhn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  score: number;

  @Column({ type: 'date' })
  date: string;
}
