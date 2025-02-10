import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class DifficultySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  maxAdditionValue: number;

  @Column()
  maxSubtractionValue: number;

  @Column()
  maxAdditionResult: number;

  @Column()
  showAddToHomescreenButton: boolean;
}
