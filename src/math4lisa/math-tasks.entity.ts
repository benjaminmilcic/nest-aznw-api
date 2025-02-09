import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class MathTasks {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  value1: number;

  @Column()
  value2: number;

  @Column()
  method: string;

  @Column()
  input: number;

  @Column()
  result: number;

  @Column()
  date: Date;

  @Column()
  ip: string;
}
