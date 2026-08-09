import { Controller, Get, Query } from '@nestjs/common';
import { TriviaQuestionDto, TriviaService } from './trivia.service';

@Controller('trivia')
export class TriviaController {
  constructor(private readonly service: TriviaService) {}

  /** Alle Fragen einer Sprache, aufsteigend nach Nummer. */
  @Get('questions')
  async getAll(@Query('lang') lang?: string): Promise<TriviaQuestionDto[]> {
    return this.service.findAll(lang);
  }

  /** Zufaellige Fragen fuer eine Spielrunde, Standard 15. */
  @Get('questions/random')
  async getRandom(
    @Query('count') count?: string,
    @Query('lang') lang?: string,
  ): Promise<TriviaQuestionDto[]> {
    return this.service.findRandom(count ? Number(count) : undefined, lang);
  }

  /**
   * Bestimmte Fragen in einer Sprache, z.B. eine laufende Runde nach dem
   * Sprachwechsel. numbers ist eine Liste wie "3,17,42".
   */
  @Get('questions/by-numbers')
  async getByNumbers(
    @Query('numbers') numbers?: string,
    @Query('lang') lang?: string,
  ): Promise<TriviaQuestionDto[]> {
    const parsed = (numbers ?? '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    return this.service.findByNumbers(parsed, lang);
  }
}
