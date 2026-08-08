import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizQuestions } from './quiz-questions.entity';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuizQuestions])],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
