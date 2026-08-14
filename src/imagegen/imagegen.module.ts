import { Module } from '@nestjs/common';
import { ImagegenController } from './imagegen.controller';
import { ImagegenService } from './imagegen.service';

@Module({
  controllers: [ImagegenController],
  providers: [ImagegenService],
})
export class ImagegenModule {}
