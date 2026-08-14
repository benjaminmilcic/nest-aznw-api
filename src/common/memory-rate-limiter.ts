import { HttpException, HttpStatus } from '@nestjs/common';

/** Einfaches In-Memory-Fenster. Reicht für eine Instanz; nach Restart leer. */
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

export function clientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  let ip =
    (typeof forwarded === 'string' ? forwarded : forwarded?.[0]) ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  return ip;
}
