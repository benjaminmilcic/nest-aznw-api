import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(800)
  prompt: string;

  @IsOptional()
  @IsIn(['flux', 'sdxl'])
  model?: 'flux' | 'sdxl';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(256)
  @Max(1280)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(256)
  @Max(1280)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4294967295)
  seed?: number;
}
