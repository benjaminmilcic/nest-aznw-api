import { CanActivate, ExecutionContext, Injectable, mixin, Type } from '@nestjs/common';
import { MemoryRateLimiter, clientIp } from './memory-rate-limiter';

/**
 * Guard that allows at most `limit` requests per visitor (IP) within `windowMs`, counted under `key`.
 * A guard runs before interceptors – so an upload is refused before multer writes anything to disk.
 */
export function RateLimitGuard(key: string, limit: number, windowMs: number): Type<CanActivate> {
  @Injectable()
  class Guard implements CanActivate {
    private static readonly limiter = new MemoryRateLimiter();

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      Guard.limiter.consume(`${key}:${clientIp(request)}`, limit, windowMs); // throws 429 above the limit
      return true;
    }
  }
  return mixin(Guard);
}
