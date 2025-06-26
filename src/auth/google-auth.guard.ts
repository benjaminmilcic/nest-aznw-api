import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor() {
    super();
  }

  // Hier fügen wir den Prompt hinzu
  getAuthenticateOptions() {
    return {
      prompt: 'select_account',
    };
  }
}
