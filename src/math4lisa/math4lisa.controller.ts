import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { TaskDto } from './dtos/task.dto';
import { Math4LisaService } from './math4lisa.service';

@Controller('math4lisa')
export class Math4LisaController {
  constructor(private math4lisaService: Math4LisaService) {}

  @Get()
  getAllTasks() {
    return this.math4lisaService.getAllTasks();
  }

  @Post()
  saveNewTask(@Body() body: TaskDto, @Req() req) {
    let ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.connection.remoteAddress ||
      req.ip;

    // If multiple IPs are returned, extract the first one
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    return this.math4lisaService.saveNewTask(
      body.value1,
      body.value2,
      body.method,
      body.input,
      ip,
    );
  }
}
