import { IsString } from 'class-validator';

export class ErrorMailDto {
  @IsString()
  error: string;
}
