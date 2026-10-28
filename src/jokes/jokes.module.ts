import { Module } from '@nestjs/common';
import { JokesController } from './jokes.controller';
import { JokesService } from './jokes.service';
import { InternalApiKeyGuard } from '../common/internal-api-key.guard';

@Module({
  controllers: [JokesController],
  providers: [JokesService, InternalApiKeyGuard],
})
export class JokesModule {}
