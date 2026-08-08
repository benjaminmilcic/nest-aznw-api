import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerLetter, QuizQuestions } from './quiz-questions.entity';

export interface QuizQuestionDto {
  id: number;
  questionNumber: number;
  question: string;
  answers: { letter: AnswerLetter; text: string }[];
  correctAnswer: AnswerLetter;
  explanation: string;
  questionImage: string | null;
  explanationImage: string | null;
  source: string;
}

const DEFAULT_COUNT = 15;
const MAX_COUNT = 50;

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(QuizQuestions)
    private readonly repo: Repository<QuizQuestions>,
  ) {}

  async findAll(): Promise<QuizQuestionDto[]> {
    try {
      const questions = await this.repo.find({
        order: { questionNumber: 'ASC' },
      });
      return questions.map((question) => this.toDto(question));
    } catch (err) {
      console.log(err);
      throw this.loadError();
    }
  }

  /** Zufaellige Fragen fuer eine Spielrunde. */
  async findRandom(count?: number): Promise<QuizQuestionDto[]> {
    const limit = this.normalizeCount(count);
    try {
      const questions = await this.repo
        .createQueryBuilder('question')
        .orderBy('RAND()')
        .limit(limit)
        .getMany();
      return questions.map((question) => this.toDto(question));
    } catch (err) {
      console.log(err);
      throw this.loadError();
    }
  }

  private normalizeCount(count?: number): number {
    if (!count || Number.isNaN(count)) {
      return DEFAULT_COUNT;
    }
    return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
  }

  private toDto(question: QuizQuestions): QuizQuestionDto {
    return {
      id: question.id,
      questionNumber: question.questionNumber,
      question: question.question,
      answers: [
        { letter: 'A', text: question.answerA },
        { letter: 'B', text: question.answerB },
        { letter: 'C', text: question.answerC },
      ],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      questionImage: question.questionImage,
      explanationImage: question.explanationImage,
      source: question.source,
    };
  }

  private loadError(): InternalServerErrorException {
    return new InternalServerErrorException({
      message: {
        de: 'Fehler beim Laden der Quizfragen.',
        en: 'Error loading the quiz questions.',
        hr: 'Greška pri učitavanju kviz pitanja.',
      },
    });
  }
}
