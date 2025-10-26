import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public readonly stripe: Stripe;
  constructor(
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_API_KEY'),
      {
        apiVersion: '2024-06-20', // Use whatever API latest version
      },
    );
  }

  async sendClientSecret() {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: 1498,
      currency: 'eur',
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }
}
