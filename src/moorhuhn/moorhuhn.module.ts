import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Moorhuhn } from './moorhuhn.entity';
import { MoorhuhnController } from './moorhuhn.controller';
import { MoorhuhnService } from './moorhuhn.service';

@Module({
  imports:[TypeOrmModule.forFeature([Moorhuhn])],
  controllers: [MoorhuhnController],
  providers: [MoorhuhnService]
})
export class MoorhuhnModule {}
