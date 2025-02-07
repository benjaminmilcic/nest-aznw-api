import { Body, Controller, Get, Post } from '@nestjs/common';
import { MoorhuhnService } from './moorhuhn.service';
import { HighscoreDto } from './dtos/highscore.dto';

@Controller('moorhuhn')
export class MoorhuhnController {
  constructor(private guestbookService: MoorhuhnService) {}

  @Get()
  getAllHighscore() {
    return this.guestbookService.getAllHighscore();
  }

  @Post()
  saveNewPost(@Body() body: HighscoreDto) {
    return this.guestbookService.saveNewHighscore(
      body.name,
      body.score,
      body.date.slice(0, 10),
    );
  }
}
