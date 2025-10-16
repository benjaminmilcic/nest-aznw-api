import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Recipes {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  // Speichere ingredients als JSON-Array
  @Column({ type: 'simple-json' })
  ingredients: string[];

  @Column()
  imagePath: string;

  @Column({ type: 'text' })
  preparation: string;
}
