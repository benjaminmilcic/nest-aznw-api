import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../common/internal-api-key.guard';
import { JokeLanguage, JokesService } from './jokes.service';

@Controller('jokes')
export class JokesController {
  constructor(private jokesService: JokesService) {}

  // For the AI chat only: on the website the jokes stay behind the login (GET /auth/jokes)
  @Get('random')
  @UseGuards(InternalApiKeyGuard)
  getRandomJoke(@Query('lang') lang: string) {
    const language: JokeLanguage = ['de', 'en', 'hr'].includes(lang)
      ? (lang as JokeLanguage)
      : 'en';
    return this.jokesService.getRandomJoke(language);
  }
}
