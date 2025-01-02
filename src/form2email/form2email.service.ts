import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class Form2emailService {
  constructor(private readonly mailerService: MailerService) {}

  sendMail(formtext: string): void {
    const message: {
      firstname: string;
      lastname: string;
      email: string;
      message: string;
    } = JSON.parse(formtext);
    this.mailerService.sendMail({
      to: 'benjamin.milcic@gmail.com',
      from: 'info@auf-zu-neuen-welten.de',
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
