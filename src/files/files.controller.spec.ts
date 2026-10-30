import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as request from 'supertest';

// Before the module is loaded: uploads of this test go to a temporary directory
const dir = mkdtempSync(join(tmpdir(), 'files-spec-'));
process.env.FILES_DIR = dir;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FilesModule } = require('./files.module');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('FilesController', () => {
  let app: INestApplication;
  let ip = 0;
  // Every test is a different visitor, so the upload limit of one test doesn't affect the others
  const upload = () => request(app.getHttpServer()).post('/files/upload').set('X-Real-IP', `203.0.113.${++ip}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FilesModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('stores an image under a new name with the extension of its type', async () => {
    const response = await upload().attach('file', PNG, { filename: 'evil.html', contentType: 'image/png' }).expect(201);
    const { file } = JSON.parse(response.text);
    expect(file).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(readdirSync(dir)).toContain(file);
  });

  it('refuses files that are not images', () =>
    upload().attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'text/html' }).expect(415));

  it('refuses images above 5 MB and leaves nothing on the disk', async () => {
    const before = readdirSync(dir).length;
    await upload()
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
    await upload().attach('file', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(415);
    expect(readdirSync(dir).length).toBe(before);
  });

  it('refuses a request without a file', () => upload().expect(400));

  it('limits a visitor to 20 uploads per hour', async () => {
    const visitor = '198.51.100.7';
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .post('/files/upload')
        .set('X-Real-IP', visitor)
        .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/files/upload')
      .set('X-Real-IP', visitor)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(429);
  });

  it('serves stored files as download and nothing outside the directory', async () => {
    writeFileSync(join(dir, 'old-upload.jpg'), 'jpg');
    const response = await request(app.getHttpServer()).get('/files/download/old-upload.jpg').expect(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    await request(app.getHttpServer()).get('/files/download/missing.png').expect(404);
    await request(app.getHttpServer()).get('/files/download/..%2F..%2Fetc%2Fpasswd').expect(404);
  });
});
