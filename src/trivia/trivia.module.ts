import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriviaQuestions } from './trivia-questions.entity';
import { TriviaController } from './trivia.controller';
import { TriviaService } from './trivia.service';

@Module({
  imports: [TypeOrmModule.forFeature([TriviaQuestions])],
  controllers: [TriviaController],
  providers: [TriviaService],
})
export class TriviaModule {}
