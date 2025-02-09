import { Module } from '@nestjs/common';
import { Form2emailModule } from './form2email/form2email.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { StripeModule } from './stripe/stripe.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestbookModule } from './guestbook/guestbook.module';
import { Guestbook } from './guestbook/guestbook.entity';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { FailedLogin } from './users/failed-login.entity';
import { MoorhuhnModule } from './moorhuhn/moorhuhn.module';
import { Moorhuhn } from './moorhuhn/moorhuhn.entity';
import { Error2emailModule } from './error2email/error2email.module';
import { MathTasks } from './math4lisa/math-tasks.entity';
import { Math4LisaModule } from './math4lisa/math4lisa.module';
import { DifficultySettings } from './math4lisa/difficulty-settings.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
      entities: [
        Guestbook,
        User,
        FailedLogin,
        Moorhuhn,
        MathTasks,
        DifficultySettings,
      ],
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
    FilesModule,
    AuthModule,
    UsersModule,
    MoorhuhnModule,
    Error2emailModule,
    Math4LisaModule,
  ],
})
export class AppModule {}
