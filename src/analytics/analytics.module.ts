import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Analytics } from './analytics.entity';
import { PageView } from './page-view.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalyticsAuthGuard } from './analytics-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Analytics, PageView]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsAuthGuard],
})
export class AnalyticsModule {}
