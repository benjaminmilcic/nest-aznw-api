import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SpeechService } from './speech.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, SpeechService],
})
export class ChatModule {}
