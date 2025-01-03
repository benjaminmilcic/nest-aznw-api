import { IsString } from 'class-validator';

export class SendMailDto {
  @IsString()
  firstname: string;
  @IsString()
  lastname: string;
  @IsString()
  email: string;
  @IsString()
  message: string;
}
