import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class Form2emailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  sendMail(formtext: string, ip: string): void {
    const message: {
      name: string;
      email: string;
      message: string;
    } = JSON.parse(formtext);
    const timestamp = new Date().toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
    });
    this.mailerService.sendMail({
      to: this.configService.get<string>('ADMIN_EMAIL'),
      from: this.configService.get<string>('SENDER_EMAIL'),
      subject: 'New message from auf-zu-neuen-welten.de',
      html:
        '<p>Name: <b>' +
        message.name +
        '</b></p><p>Email: <b>' +
        message.email +
        '</b></p><p>Message: <b>' +
        message.message +
        '</b></p><hr><p>Gesendet am: ' +
        timestamp +
        '</p><p>IP-Adresse: ' +
        ip +
        '</p>',
    });
  }
}
