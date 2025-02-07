import { IsNumber, IsString } from 'class-validator';

export class HighscoreDto {
  @IsString()
  name: string;
  @IsNumber()
  score: number;
  @IsString()
  date: string;
}
