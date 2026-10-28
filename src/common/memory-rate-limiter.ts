import { HttpException, HttpStatus } from '@nestjs/common';

/** Simple in-memory window. Enough for one instance; empty after a restart. */
export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  consume(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      throw new HttpException(
        { error: 'Too many requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}

/**
 * IP address of the visitor, tamper-proof behind Cloudflare + Apache:
 * 1. X-Real-IP – set by Apache itself (RequestHeader set, overwrites anything sent along) from the address
 *    corrected by mod_remoteip.
 * 2. The LAST entry of X-Forwarded-For – Apache appends it. The FIRST one can be sent by the visitor
 *    (Cloudflare only appends), which would get around every limit.
 * 3. The socket address (locally without a proxy).
 */
export function clientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
}): string {
  const header = (name: string) => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value.join(',') : value)?.trim() || '';
  };
  const realIp = header('x-real-ip');
  if (realIp) return realIp;
  const forwarded = header('x-forwarded-for').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (forwarded.length) return forwarded[forwarded.length - 1];
  return req.connection?.remoteAddress || req.ip || 'unknown';
}
