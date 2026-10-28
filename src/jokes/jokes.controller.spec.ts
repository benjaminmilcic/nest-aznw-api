import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AvailabilityModule } from '../availability/availability.module';
import { JokesModule } from './jokes.module';
import { JokesService } from './jokes.service';

describe('JokesController and AvailabilityController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = 'test-key';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), JokesModule, AvailabilityModule],
    })
      .overrideProvider(JokesService)
      .useValue({
        getRandomJoke: (language: string) => ({ language, text: 'Witz', total: 1 }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('rejects requests without the internal key', () =>
    request(app.getHttpServer()).get('/jokes/random?lang=de').expect(401));

  it('rejects a wrong internal key', () =>
    request(app.getHttpServer())
      .get('/jokes/random?lang=de')
      .set('x-internal-api-key', 'wrong')
      .expect(401));

  it('returns a joke in the requested language', () =>
    request(app.getHttpServer())
      .get('/jokes/random?lang=hr')
      .set('x-internal-api-key', 'test-key')
      .expect(200)
      .expect({ language: 'hr', text: 'Witz', total: 1 }));

  it('falls back to English for unknown languages', () =>
    request(app.getHttpServer())
      .get('/jokes/random?lang=es')
      .set('x-internal-api-key', 'test-key')
      .expect(200)
      .expect((res) => expect(res.body.language).toBe('en')));

  it('returns the availability publicly', () =>
    request(app.getHttpServer())
      .get('/availability')
      .expect(200)
      .expect((res) => {
        expect(res.body.available).toBe(true);
        expect(res.body.quarter).toBe(Math.floor(new Date().getMonth() / 3) + 1);
      }));
});
