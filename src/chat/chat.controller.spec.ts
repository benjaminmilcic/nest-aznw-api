import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ChatModule } from './chat.module';
import { ChatService } from './chat.service';
import { SpeechService, speakable } from './speech.service';

describe('ChatController', () => {
  let app: INestApplication;
  const streamReply = jest.fn();
  const synthesize = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), ChatModule],
    })
      .overrideProvider(ChatService)
      .useValue({ streamReply, reset: jest.fn(), transcribe: jest.fn() })
      .overrideProvider(SpeechService)
      .useValue({ synthesize })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(() => app.close());

  it('passes the events of the Python API through as Server-Sent Events', async () => {
    streamReply.mockImplementation(async function* () {
      yield { tool: 'search_recipes' };
      yield { token: 'Hallo' };
    });
    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .send({ sessionId: 'session-test-1', message: 'Hi', language: 'de' })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);
    expect(response.text).toBe(':ok\n\ndata: {"tool":"search_recipes"}\n\ndata: {"token":"Hallo"}\n\ndata: [DONE]\n\n');
    expect(streamReply).toHaveBeenCalledWith('session-test-1', 'Hi', undefined, 'de', expect.any(AbortSignal));
  });

  it('reports a failing Python API inside the stream', async () => {
    streamReply.mockImplementation(async function* () {
      throw new Error('down');
    });
    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .send({ sessionId: 'session-test-2', message: 'Hi' })
      .expect(200);
    expect(response.text).toContain('"code":"error"');
  });

  it('rejects invalid requests', () =>
    request(app.getHttpServer()).post('/chat/stream').send({ sessionId: 'x', message: '' }).expect(400));

  it('limits a visitor to 5 questions per minute', async () => {
    streamReply.mockImplementation(async function* () {
      yield { token: 'ok' };
    });
    const ask = () =>
      request(app.getHttpServer())
        .post('/chat/stream')
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ sessionId: 'session-test-3', message: 'Hi' });
    for (let i = 0; i < 5; i++) await ask().expect(200);
    const response = await ask().expect(429);
    expect(response.body.code).toBe('rate_limit');
  });

  describe('read aloud', () => {
    it('returns the spoken text as MP3 in the voice of the language', async () => {
      synthesize.mockResolvedValue(Buffer.from('mp3'));
      const response = await request(app.getHttpServer())
        .post('/chat/speech')
        .send({ text: 'Hallo Welt.', language: 'hr' })
        .expect(201)
        .expect('Content-Type', 'audio/mpeg');
      expect(response.body.toString()).toBe('mp3');
      expect(synthesize).toHaveBeenCalledWith('Hallo Welt.', 'hr');
    });

    it('answers 204 when there is nothing to say', async () => {
      synthesize.mockClear();
      await request(app.getHttpServer()).post('/chat/speech').send({ text: '👍 **' }).expect(204);
      expect(synthesize).not.toHaveBeenCalled();
    });

    it('rejects unknown languages', () =>
      request(app.getHttpServer()).post('/chat/speech').send({ text: 'Hi', language: 'fr' }).expect(400));

    it('answers 503 when the voice service fails, so the browser voice takes over', async () => {
      synthesize.mockRejectedValue(new Error('blocked'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await request(app.getHttpServer()).post('/chat/speech').send({ text: 'Hallo.' }).expect(503);
    });

    it('reads neither Markdown, links, images nor emojis', () => {
      expect(speakable('## Hallo 👋🏽 **Welt**! Siehe [Wetter](/gimmicks/weather) ![Bild](https://x/y.png) https://github.com/x')).toBe(
        'Hallo Welt! Siehe Wetter',
      );
    });
  });
});
