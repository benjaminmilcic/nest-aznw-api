import { Body, Controller, Get, Post } from '@nestjs/common';
import { Error2emailService } from './error2email.service';
import { ErrorMailDto } from './dtos/error-mail.dto';

@Controller('error2email')
export class Error2emailController {
  constructor(private readonly error2emailService: Error2emailService) {}

  @Post()
  sendErrorMail(@Body() body: ErrorMailDto) {
    return this.error2emailService.sendErrorMail(JSON.stringify(body));
  }
}
