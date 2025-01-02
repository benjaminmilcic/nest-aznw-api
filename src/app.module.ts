import { Module } from '@nestjs/common';
import { Form2emailModule } from './form2email/form2email.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { StripeModule } from './stripe/stripe.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: 'smtp.strato.de',
        auth: {
          user: 'info@auf-zu-neuen-welten.de',
          pass: 'nest-form2mail',
        },
      },
    }),
    Form2emailModule,
    ConfigModule.forRoot(),
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
  ],
})
export class AppModule {}
