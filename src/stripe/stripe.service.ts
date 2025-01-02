import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public readonly stripe: Stripe;
  constructor(
  ) {
    this.stripe = new Stripe(
      'sk_test_51P05azL6Qm22ltjdxUjj3yspSzTt5kH0VcfEJxFWebr7fnFxI42OATXWdS1KhgZBSqeuWkYNsJB5NPTqUBepP83A00WTzj93hw',
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
