import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express'; // Import Express Response
import { GoogleAuthGuard } from './google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.signup(email, password);
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Req() req,
  ) {
    let ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.connection.remoteAddress ||
      req.ip;

    // If multiple IPs are returned, extract the first one
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    return this.authService.login(email, password, ip);
  }

  @Get('jokes')
  @UseGuards(AuthGuard) // Protect the route
  async getProtectedJson() {
    const filePath = path.join(process.cwd() + '/../jokefile/', 'jokes.json');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('JSON file not found');
    }

    // Read and parse JSON file
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    return jsonData; // Return parsed JSON data
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard) // <-- unser eigener Guard
  async googleAuth() {
    // Wird automatisch umgeleitet
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    // req.user enthält die Google-Daten aus GoogleStrategy.validate()

    const jwt = await this.authService.loginWithGoogle(req.user);

    if (process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'development') {
      return res.redirect(
        `http://localhost:4200/#/gimmicks/auth/google-redirect?token=${jwt.token}`,
      );
    } else {
      return res.redirect(
        `https://auf-zu-neuen-welten.de/#/gimmicks/auth/google-redirect?token=${jwt.token}`,
      );
    }
  }
}
