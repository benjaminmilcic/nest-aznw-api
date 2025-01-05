import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

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
}
