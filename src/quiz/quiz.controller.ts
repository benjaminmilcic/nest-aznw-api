import { Controller, Get, Query } from '@nestjs/common';
import { QuizQuestionDto, QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly service: QuizService) {}

  /** Alle Fragen, aufsteigend nach Nummer im Buch. */
  @Get('questions')
  async getAll(): Promise<QuizQuestionDto[]> {
    return this.service.findAll();
  }

  /** Zufaellige Fragen fuer eine Spielrunde, Standard 15. */
  @Get('questions/random')
  async getRandom(@Query('count') count?: string): Promise<QuizQuestionDto[]> {
    return this.service.findRandom(count ? Number(count) : undefined);
  }
}
