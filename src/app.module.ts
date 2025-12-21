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
import { YahtzeeGameModule } from './yahtzee-game/yahtzee-game.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { Recipes } from './recipes/recipes.entity';
import { RecipesModule } from './recipes/recipes.module';
import { Analytics } from './analytics/analytics.entity';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST'),
          auth: {
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASS'),
          },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: +configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          Guestbook,
          User,
          FailedLogin,
          Moorhuhn,
          MathTasks,
          DifficultySettings,
          Recipes,
          Analytics,
        ],
        synchronize: true,
      }),
    }),
    StripeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>('STRIPE_API_KEY'),
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
    YahtzeeGameModule,
    GeolocationModule,
    RecipesModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
