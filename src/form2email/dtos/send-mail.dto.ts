import { IsString } from 'class-validator';

export class SendMailDto {
  @IsString()
  name: string;
  @IsString()
  email: string;
  @IsString()
  message: string;
}
