import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigurableModuleClass } from './stripe.module-definition';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';

@Module({
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
  imports: [ConfigModule],
})
export class StripeModule extends ConfigurableModuleClass {}
