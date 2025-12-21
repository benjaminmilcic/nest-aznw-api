import { IsString, IsISO8601, IsOptional } from 'class-validator';

export class PageViewDto {
  @IsString()
  sessionId: string;

  @IsString()
  route: string;

  @IsISO8601()
  timestamp: string;

  @IsOptional()
  @IsString()
  referrer?: string;
}
