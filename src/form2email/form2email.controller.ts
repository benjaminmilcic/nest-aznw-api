import { Body, Controller, Get, Post } from '@nestjs/common';
import { Form2emailService } from './form2email.service';
import { SendMailDto } from './dtos/send-mail.dto';

@Controller('form2email')
export class Form2emailController {
  constructor(private readonly form2emailService: Form2emailService) {}

  @Post()
  sendMail(@Body() body: SendMailDto) {
    return this.form2emailService.sendMail(JSON.stringify(body));
  }
}
