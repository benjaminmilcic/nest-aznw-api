import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramGateway } from './telegram.gateway';

@Module({
  controllers: [TelegramController],
  providers: [TelegramService, TelegramGateway],
  exports: [TelegramService],
})
export class TelegramModule {}
