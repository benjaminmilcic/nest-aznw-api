import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, ValidateNested, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

class ScreenResolutionDto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

class ViewportSizeDto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class VisitorDataDto {
  @IsISO8601()
  timestamp: string;

  @IsString()
  userAgent: string;

  @IsString()
  language: string;

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsString()
  platform: string;

  @ValidateNested()
  @Type(() => ScreenResolutionDto)
  screenResolution: ScreenResolutionDto;

  @ValidateNested()
  @Type(() => ViewportSizeDto)
  viewportSize: ViewportSizeDto;

  @IsString()
  timezone: string;

  @IsNumber()
  timezoneOffset: number;

  @IsBoolean()
  cookiesEnabled: boolean;

  @IsString()
  referrer: string;

  @IsOptional()
  @IsNumber()
  deviceMemory?: number;

  @IsOptional()
  @IsNumber()
  hardwareConcurrency?: number;

  @IsOptional()
  @IsString()
  connectionType?: string;

  @IsBoolean()
  online: boolean;
}
