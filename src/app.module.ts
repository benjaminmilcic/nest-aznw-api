import { Module } from '@nestjs/common';
import { Form2emailModule } from './form2email/form2email.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { StripeModule } from './stripe/stripe.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestbookModule } from './guestbook/guestbook.module';
import { Guestbook } from './guestbook/guestbook.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.strato.de',
        auth: {
          user: 'info@auf-zu-neuen-welten.de',
          pass: 'nest-form2mail',
        },
      },
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'benjamin',
      password: 'homeschooling',
      database: 'guestbook',
      entities: [Guestbook],
      synchronize: false,
    }),
    StripeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>(
          'sk_test_51P05azL6Qm22ltjdxUjj3yspSzTt5kH0VcfEJxFWebr7fnFxI42OATXWdS1KhgZBSqeuWkYNsJB5NPTqUBepP83A00WTzj93hw',
        ),
        options: {
          apiVersion: '2024-06-20',
        },
      }),
    }),
    Form2emailModule,
    GuestbookModule,
  ],
})
export class AppModule {}
