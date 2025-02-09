import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MathTasks } from './math-tasks.entity';
import { Math4LisaController } from './math4lisa.controller';
import { Math4LisaService } from './math4lisa.service';

@Module({
  imports:[TypeOrmModule.forFeature([MathTasks])],
  controllers: [Math4LisaController],
  providers: [Math4LisaService]
})
export class Math4LisaModule {}
