import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AnswerLetter = 'A' | 'B' | 'C';
export type QuestionLanguage = 'de' | 'en' | 'hr';

export const QUESTION_LANGUAGES: QuestionLanguage[] = ['de', 'en', 'hr'];

/**
 * Fragen fuer das Spiel "Schon gewusst?".
 * Angelegt per db/trivia_questions.sql, wird von der API nur gelesen.
 *
 * Jede Frage liegt einmal je Sprache vor. questionNumber ist dabei ueber alle
 * Sprachen dieselbe, so dass sich zu einer laufenden Runde die passenden
 * Uebersetzungen nachladen lassen. Der richtige Buchstabe ist in allen
 * Sprachen identisch.
 */
@Entity()
export class TriviaQuestions {
  @PrimaryGeneratedColumn()
  id: number;

  // Fortlaufende Nummer, ueber alle Sprachen hinweg dieselbe Frage
  @Column()
  questionNumber: number;

  @Column({ type: 'enum', enum: QUESTION_LANGUAGES })
  language: QuestionLanguage;

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
