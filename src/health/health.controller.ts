import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Written by the deploy workflow into dist/ – the health check of the workflow waits until exactly this commit answers
const BUILD_INFO = path.join(__dirname, '..', 'build-info.json');

function readBuild(): string {
  try {
    return JSON.parse(fs.readFileSync(BUILD_INFO, 'utf8')).commit ?? 'unknown';
  } catch {
    return 'local';
  }
}

@Controller('health')
export class HealthController {
  private readonly build = readBuild();

  @Get()
  health() {
    return { status: 'ok', build: this.build };
  }
}
