import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerLetter, TriviaQuestions } from './trivia-questions.entity';

export interface TriviaQuestionDto {
  id: number;
  questionNumber: number;
  question: string;
  answers: { letter: AnswerLetter; text: string }[];
  correctAnswer: AnswerLetter;
  explanation: string;
  image: string | null;
  category: string;
}

const DEFAULT_COUNT = 15;
const MAX_COUNT = 50;

@Injectable()
export class TriviaService {
  constructor(
    @InjectRepository(TriviaQuestions)
    private readonly repo: Repository<TriviaQuestions>,
  ) {}

  async findAll(): Promise<TriviaQuestionDto[]> {
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
  async findRandom(count?: number): Promise<TriviaQuestionDto[]> {
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

  private toDto(question: TriviaQuestions): TriviaQuestionDto {
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
      image: question.image,
      category: question.category,
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
