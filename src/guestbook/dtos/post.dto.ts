import { IsISO8601, IsString } from 'class-validator';

export class PostDto {
  @IsString()
  name: string;
  @IsString()
  content: string;
  @IsISO8601()
  date: string;
}
