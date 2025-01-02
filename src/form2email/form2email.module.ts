import { Module } from '@nestjs/common';
import { Form2emailController } from './form2email.controller';
import { Form2emailService } from './form2email.service';

@Module({
  controllers: [Form2emailController],
  providers: [Form2emailService],
})
export class Form2emailModule {}
