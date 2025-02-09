import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MathTasks } from './math-tasks.entity';

@Injectable()
export class Math4LisaService {
  constructor(
    @InjectRepository(MathTasks) private repo: Repository<MathTasks>,
  ) {}

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
