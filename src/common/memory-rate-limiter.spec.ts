import { clientIp } from './memory-rate-limiter';

describe('clientIp', () => {
  it('prefers X-Real-IP, which Apache sets itself', () => {
    expect(clientIp({ headers: { 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4, 198.51.100.9' } })).toBe(
      '198.51.100.9',
    );
  });

  it('takes the last X-Forwarded-For entry – the first one can be faked by the visitor', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.9, 198.51.100.9' } })).toBe('198.51.100.9');
  });

  it('falls back to the socket address without a proxy', () => {
    expect(clientIp({ headers: {}, connection: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });
});
