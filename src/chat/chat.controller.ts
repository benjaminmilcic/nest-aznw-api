import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { MemoryRateLimiter, clientIp } from '../common/memory-rate-limiter';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dtos/chat-request.dto';
import { SpeechRequestDto } from './dtos/speech-request.dto';
import { SpeechService, speakable } from './speech.service';

/** The parts of a multer upload we need */
interface AudioUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Cloudflare closes a request without a first byte after 100 s – a comment line every 15 s keeps it open */
const HEARTBEAT_MS = 15 * 1000;

@Controller('chat')
export class ChatController {
  private readonly rateLimiter = new MemoryRateLimiter();

  constructor(
    private readonly chatService: ChatService,
    private readonly speechService: SpeechService,
  ) {}

  /**
   * Streams the answer as Server-Sent Events, passed through from the Python API:
   * `data: {"token": "..."}` …, `{"tool": "..."}`, `{"action": "request_location"}`, `{"summary": {...}}`,
   * `{"usage": {...}}`, then `data: [DONE]` – or `{"error": "...", "code": "rate_limit" | "daily_limit" | "error"}`.
   */
  @Post('stream')
  @HttpCode(200)
  async stream(@Body() body: ChatRequestDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    // Per visitor – the daily budget in python-aznw-api caps the costs of all visitors together
    const ip = clientIp(req);
    if (!this.limit(res, `chat:${ip}`, 5, 60 * 1000) || !this.limit(res, `chat-day:${ip}`, 100, 24 * 60 * 60 * 1000)) {
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(':ok\n\n');
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    const abort = new AbortController();
    res.on('close', () => abort.abort());
    try {
      for await (const event of this.chatService.streamReply(body.sessionId, body.message, body.location, body.language, abort.signal)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      if (!abort.signal.aborted) {
        console.error('Chat failed:', err);
        res.write(`data: ${JSON.stringify({ error: 'The AI chat is not available right now.', code: 'error' })}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  @Delete(':sessionId')
  reset(@Param('sessionId') sessionId: string): void {
    this.chatService.reset(sessionId);
  }

  /** Speech input: multipart/form-data with the recording in `audio` and `quality` (fast | quality). */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  async transcribe(
    @UploadedFile() audio: AudioUpload | undefined,
    @Body('quality') quality: string,
    @Req() req: Request,
  ): Promise<{ text: string }> {
    this.rateLimiter.consume(`transcribe:${clientIp(req)}`, 10, 60 * 1000);
    if (!audio?.buffer?.length) {
      throw new BadRequestException('audio file is required');
    }
    const response = await this.chatService
      .transcribe(audio.buffer, audio.originalname, audio.mimetype, quality === 'fast' ? 'fast' : 'quality')
      .catch(() => {
        throw new HttpException({ error: 'Speech recognition is not available' }, 503);
      });
    if (response.status === 429) {
      throw new HttpException({ error: 'rate_limit' }, 429);
    }
    if (!response.ok) {
      throw new HttpException({ error: 'Speech recognition failed' }, 502);
    }
    return (await response.json()) as { text: string };
  }

  /** Read aloud: one or a few sentences of an answer as MP3 in the voice of `language` – 204 if there is nothing to say. */
  @Post('speech')
  async speech(@Body() body: SpeechRequestDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    // The frontend requests one call per sentence – a long answer has 20 or more
    this.rateLimiter.consume(`speech:${clientIp(req)}`, 120, 10 * 60 * 1000);
    if (!speakable(body.text)) {
      res.status(204).end();
      return;
    }
    const audio = await this.speechService.synthesize(body.text, body.language ?? 'de').catch((err) => {
      console.error('Text-to-speech failed:', err);
      throw new HttpException({ error: 'Text-to-speech is not available' }, 503);
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.end(audio);
  }

  /** Answers 429 with code "rate_limit" when the visitor asked too much – returns false then. */
  private limit(res: Response, key: string, max: number, windowMs: number): boolean {
    try {
      this.rateLimiter.consume(key, max, windowMs);
      return true;
    } catch {
      res.status(429).json({ error: 'Too many questions', code: 'rate_limit' });
      return false;
    }
  }
}
