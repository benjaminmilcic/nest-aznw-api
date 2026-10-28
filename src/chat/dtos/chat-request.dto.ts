import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class LocationDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

export class ChatRequestDto {
  // Created by the frontend per chat (crypto.randomUUID)
  @IsString()
  @Matches(/^[\w-]{8,64}$/)
  sessionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  // Browser location of the visitor, only sent after they allowed it (for the weather tool)
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  // Language of the website – the answer language when the message itself has none (e.g. "aaaa")
  @IsOptional()
  @IsIn(['de', 'en', 'hr'])
  language?: 'de' | 'en' | 'hr';
}
