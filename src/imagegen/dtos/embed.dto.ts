import { IsString, MaxLength, MinLength } from 'class-validator';

export class EmbedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  q: string;
}
