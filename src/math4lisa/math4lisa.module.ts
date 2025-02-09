import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MathTasks } from './math-tasks.entity';
import { Math4LisaController } from './math4lisa.controller';
import { Math4LisaService } from './math4lisa.service';
import { DifficultySettingsGateway } from './difficulty-settings.gateway';
import { DifficultySettings } from './difficulty-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MathTasks, DifficultySettings])],
  controllers: [Math4LisaController],
  providers: [Math4LisaService, DifficultySettingsGateway],
})
export class Math4LisaModule {}
