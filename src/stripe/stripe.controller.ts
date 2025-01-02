import { Body, Controller, Get, Post } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private stripeService: StripeService) {}

  @Post()
  sendClientSecret(@Body() body) {
    return this.stripeService.sendClientSecret();
  }
}
