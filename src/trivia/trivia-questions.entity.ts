import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AnswerLetter = 'A' | 'B' | 'C';

/**
 * Fragen fuer das Spiel "Schon gewusst?".
 * Angelegt per db/trivia_questions.sql, wird von der API nur gelesen.
 */
@Entity()
export class TriviaQuestions {
  @PrimaryGeneratedColumn()
  id: number;

  // Fortlaufende Nummer, dient nur als stabiler Schluessel beim Neuimport
  @Column()
  questionNumber: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answerA: string;

  @Column({ type: 'text' })
  answerB: string;

  @Column({ type: 'text' })
  answerC: string;

  @Column({ type: 'enum', enum: ['A', 'B', 'C'] })
  correctAnswer: AnswerLetter;

  // Absaetze sind mit \n\n getrennt
  @Column({ type: 'mediumtext' })
  explanation: string;

  // Pfad im Frontend, z.B. assets/quiz-illustrations/emmentaler.svg
  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string | null;

  // Themenbereich, wird im Spiel als Chip angezeigt
  @Column({ type: 'varchar', length: 64 })
  category: string;
}
