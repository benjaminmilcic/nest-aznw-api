import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly elevenLabsApiKey: string;
  private readonly voiceId = 'pNInz6obpgDQGcFmaJgB';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.elevenLabsApiKey =
      this.configService.get<string>('ELEVENLABS_API_KEY') || '';
  }

  async signup(email: string, password: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new UnauthorizedException({ error: { message: 'EMAIL_EXISTS' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.createUser(email, hashedPassword);

    return this.generateAuthResponse(user);
  }

  async login(email: string, password: string, ip: string) {
    // 🔹 Check if the IP & email combination is blocked
    const isBlocked = await this.usersService.isBlocked(ip);
    if (isBlocked) {
      throw new ForbiddenException({
        error: {
          message: 'Too many failed login attempts. Try again in 5 minutes.',
        },
      });
    }
    // 🔹 Find the user in the database
    const user = await this.usersService.findByEmail(email);

    // 🔹 Check if the password is correct
    if (!user || !(await bcrypt.compare(password, user.password))) {
      await this.usersService.incrementFailedLogin(ip);
      throw new UnauthorizedException({
        error: { message: 'INVALID_LOGIN_CREDENTIALS' },
      });
    }

    // Reset failed login attempts on successful login
    await this.usersService.resetFailedLogin(ip);

    return this.generateAuthResponse(user, true);
  }

  private generateAuthResponse(user: any, registered = false) {
    const payload = { email: user.email, sub: user.id };
    const idToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      idToken,
      email: user.email,
      refreshToken,
      expiresIn: '3600',
      localId: user.id,
      registered,
    };
  }

  async loginWithGoogle(user: any) {
    // Hier kannst du Nutzer in DB speichern / prüfen, falls gewünscht

    const payload = { email: user.email, sub: user.email };
    const token = this.jwtService.sign(payload, { expiresIn: '1h' });

    return { token };
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      throw new HttpException(
        { error: 'ElevenLabs ist nicht konfiguriert' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey,
          },
          responseType: 'arraybuffer',
          timeout: 30000,
        },
      );
      return Buffer.from(response.data);
    } catch (error) {
      throw new HttpException(
        { error: 'Sprachausgabe fehlgeschlagen' },
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
