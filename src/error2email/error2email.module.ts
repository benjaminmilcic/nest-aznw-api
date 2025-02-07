import { Module } from '@nestjs/common';
import { Error2emailController } from './error2email.controller';
import { Error2emailService } from './error2email.service';

@Module({
  controllers: [Error2emailController],
  providers: [Error2emailService],
})
export class Error2emailModule {}
