import { IsNumber, IsString } from 'class-validator';

export class TaskDto {
  @IsNumber()
  value1: number;
  @IsNumber()
  value2: number;
  @IsString()
  method: string;
  @IsNumber()
  input: number;
}
