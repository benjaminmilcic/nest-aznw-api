import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AnswerLetter,
  QUESTION_LANGUAGES,
  QuestionLanguage,
  TriviaQuestions,
} from './trivia-questions.entity';

export interface TriviaQuestionDto {
  id: number;
  questionNumber: number;
  language: QuestionLanguage;
  question: string;
  answers: { letter: AnswerLetter; text: string }[];
  correctAnswer: AnswerLetter;
  explanation: string;
  image: string | null;
  category: string;
}

const DEFAULT_COUNT = 15;
const MAX_COUNT = 50;
const DEFAULT_LANGUAGE: QuestionLanguage = 'de';
/** Obergrenze fuer das Nachladen einer Runde, etwas ueber MAX_COUNT. */
const MAX_NUMBERS = 60;

@Injectable()
export class TriviaService {
  constructor(
    @InjectRepository(TriviaQuestions)
    private readonly repo: Repository<TriviaQuestions>,
  ) {}

  async findAll(language?: string): Promise<TriviaQuestionDto[]> {
    try {
      const questions = await this.repo.find({
        where: { language: this.normalizeLanguage(language) },
        order: { questionNumber: 'ASC' },
      });
      return questions.map((question) => this.toDto(question));
    } catch (err) {
      console.log(err);
      throw this.loadError();
    }
  }

  /** Zufaellige Fragen fuer eine Spielrunde. */
  async findRandom(
    count?: number,
    language?: string,
  ): Promise<TriviaQuestionDto[]> {
    const limit = this.normalizeCount(count);
    try {
      const questions = await this.repo
        .createQueryBuilder('question')
        .where('question.language = :language', {
          language: this.normalizeLanguage(language),
        })
        .orderBy('RAND()')
        .limit(limit)
        .getMany();
      return questions.map((question) => this.toDto(question));
    } catch (err) {
      console.log(err);
      throw this.loadError();
    }
  }

  /**
   * Dieselben Fragen in einer anderen Sprache. Wird beim Sprachwechsel mitten
   * in einer Runde benutzt, damit Punktestand und Position erhalten bleiben.
   * Die Reihenfolge der uebergebenen Nummern wird beibehalten.
   */
  async findByNumbers(
    numbers: number[],
    language?: string,
  ): Promise<TriviaQuestionDto[]> {
    const wanted = this.normalizeNumbers(numbers);
    if (wanted.length === 0) {
      return [];
    }
    try {
      const questions = await this.repo.find({
        where: {
          language: this.normalizeLanguage(language),
          questionNumber: In(wanted),
        },
      });
      const byNumber = new Map(
        questions.map((question) => [question.questionNumber, question]),
      );
      return wanted
        .map((number) => byNumber.get(number))
        .filter((question): question is TriviaQuestions => !!question)
        .map((question) => this.toDto(question));
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

  /** Unbekannte oder fehlende Sprache faellt auf Deutsch zurueck. */
  private normalizeLanguage(language?: string): QuestionLanguage {
    const candidate = (language ?? '').trim().toLowerCase();
    return QUESTION_LANGUAGES.includes(candidate as QuestionLanguage)
      ? (candidate as QuestionLanguage)
      : DEFAULT_LANGUAGE;
  }

  /** Gueltige Nummern, ohne Doppelte, Reihenfolge bleibt, hart begrenzt. */
  private normalizeNumbers(numbers: number[]): number[] {
    const result: number[] = [];
    const seen = new Set<number>();
    for (const value of numbers) {
      if (!Number.isInteger(value) || value <= 0 || seen.has(value)) {
        continue;
      }
      seen.add(value);
      result.push(value);
      if (result.length >= MAX_NUMBERS) {
        break;
      }
    }
    return result;
  }

  private toDto(question: TriviaQuestions): TriviaQuestionDto {
    return {
      id: question.id,
      questionNumber: question.questionNumber,
      language: question.language,
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
