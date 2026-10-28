import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Protects endpoints that only other services of the website may call (e.g. the
 * Python API of the AI chat). The caller sends the shared secret INTERNAL_API_KEY
 * in the header "x-internal-api-key". Without INTERNAL_API_KEY every request is denied.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    const given = context.switchToHttp().getRequest().headers['x-internal-api-key'];

    if (!expected || typeof given !== 'string') {
      throw new UnauthorizedException();
    }
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
