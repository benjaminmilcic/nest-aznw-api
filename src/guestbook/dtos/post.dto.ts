import { IsString } from 'class-validator';

export class PostDto {
  @IsString()
  name: string;
  @IsString()
  content: string;
  @IsString()
  date: string;
}
