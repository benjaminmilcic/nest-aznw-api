import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AnswerLetter = 'A' | 'B' | 'C';

/**
 * Quizfragen aus dem Buch "Wer weiß denn sowas?".
 * Angelegt per db/quiz_questions.sql, wird von der API nur gelesen.
 */
@Entity()
export class QuizQuestions {
  @PrimaryGeneratedColumn()
  id: number;

  // Nummer der Frage im Buch (1-154)
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

  // Pfad im Frontend, z.B. assets/quiz-wwds/frage-001.jpeg
  @Column({ type: 'varchar', length: 255, nullable: true })
  questionImage: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  explanationImage: string | null;

  @Column()
  source: string;
}
