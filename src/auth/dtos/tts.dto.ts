import { IsString, MaxLength, MinLength } from 'class-validator';

export class TtsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
