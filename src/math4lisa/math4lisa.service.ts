import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MathTasks } from './math-tasks.entity';
import { DifficultySettings } from './difficulty-settings.entity';

@Injectable()
export class Math4LisaService {
  constructor(
    @InjectRepository(MathTasks) private repo: Repository<MathTasks>,
    @InjectRepository(DifficultySettings)
    private difficultiSettingsRepo: Repository<DifficultySettings>,
  ) {}

  async getDifficultySettings(): Promise<DifficultySettings> {
    return this.difficultiSettingsRepo.findOneBy({ id: 1 });
  }

  async updateDifficultySettings(
    newSettings: Partial<DifficultySettings>,
  ): Promise<DifficultySettings> {
    let settingsfound = await this.difficultiSettingsRepo.findOneBy({ id: 1 });
    if (settingsfound) {
      await this.difficultiSettingsRepo.update(1, newSettings);
    } else {
      const createSettings = this.difficultiSettingsRepo.create(newSettings);
      await this.difficultiSettingsRepo.save(createSettings);
    }
    return this.getDifficultySettings();
  }

  getAllTasks() {
    return this.repo.find();
  }

  saveNewTask(
    value1: number,
    value2: number,
    method: string,
    input: number,
    ip: string,
  ) {
    let result;
    if (method === '+') {
      result = value1 + value2;
    } else {
      result = value1 - value2;
    }
    let date = new Date();
    const newTask = this.repo.create({
      value1,
      value2,
      method,
      input,
      result,
      date,
      ip,
    });
    return this.repo.save(newTask);
  }
}
