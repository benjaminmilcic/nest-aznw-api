import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Analytics } from './analytics.entity';
import { PageView } from './page-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Analytics, PageView])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
