import { Module } from '@nestjs/common';
import { GuestbookController } from './guestbook.controller';
import { GuestbookService } from './guestbook.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guestbook } from './guestbook.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Guestbook])],
  controllers: [GuestbookController],
  providers: [GuestbookService]
})
export class GuestbookModule {}
