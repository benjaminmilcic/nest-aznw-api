import { Controller, Get, Query } from '@nestjs/common';
import { TriviaQuestionDto, TriviaService } from './trivia.service';

@Controller('trivia')
export class TriviaController {
  constructor(private readonly service: TriviaService) {}

  /** Alle Fragen, aufsteigend nach Nummer. */
  @Get('questions')
  async getAll(): Promise<TriviaQuestionDto[]> {
    return this.service.findAll();
  }

  /** Zufaellige Fragen fuer eine Spielrunde, Standard 15. */
  @Get('questions/random')
  async getRandom(
    @Query('count') count?: string,
  ): Promise<TriviaQuestionDto[]> {
    return this.service.findRandom(count ? Number(count) : undefined);
  }
}
