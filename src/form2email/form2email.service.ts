import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class Form2emailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  sendMail(formtext: string): void {
    const message: {
      firstname: string;
      lastname: string;
      email: string;
      message: string;
    } = JSON.parse(formtext);
    this.mailerService.sendMail({
      to: this.configService.get<string>('ADMIN_EMAIL'),
      from: this.configService.get<string>('SENDER_EMAIL'),
      subject: 'new message from auf-zu-neuen-welten.de',
      html:
        '<p>First name: <b>' +
        message.firstname +
        '</b></p><p>Last name: <b>' +
        message.lastname +
        '</b></p><p>eMail: <b>' +
        message.email +
        '</b></p><p>Message: <b>' +
        message.message +
        '</b></p>',
    });
  }
}
