import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Form2emailService } from './form2email.service';
import { SendMailDto } from './dtos/send-mail.dto';

@Controller('form2email')
export class Form2emailController {
  constructor(private readonly form2emailService: Form2emailService) {}

  @Post()
  sendMail(@Body() body: SendMailDto, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return this.form2emailService.sendMail(JSON.stringify(body), ip as string);
  }
}
