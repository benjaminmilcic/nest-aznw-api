import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { SpeechLanguage } from '../speech.service';

export class SpeechRequestDto {
  // The frontend sends one or a few sentences of an answer at a time
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  // Language of the answer – picks the voice
  @IsOptional()
  @IsIn(['de', 'en', 'hr'])
  language?: SpeechLanguage;
}
