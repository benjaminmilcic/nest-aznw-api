import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HistoryMessage {
  /** 'system' is the summary of older messages, created by the Python API when the context window gets full. */
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Session {
  history: HistoryMessage[];
  lastUsed: number;
}

/** Sent by the Python API before the answer when older messages had to be summarized. */
interface Summary {
  content: string;
  /** Number of messages at the start of the history that the summary replaces. */
  replacedMessages: number;
}

/** One event of the answer stream, passed on to the frontend unchanged (see python-aznw-api). */
export type ChatEvent = Record<string, unknown>;

/** A chat is forgotten after this time without a new question. */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
/** Upper limit of chats kept at the same time – the oldest is dropped first. */
const MAX_SESSIONS = 1000;

/**
 * The AI chat: keeps the conversation history per session in memory (nothing is stored permanently) and forwards
 * every question with its history to the Python API (python-aznw-api), which talks to the language model.
 */
@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly pythonApiUrl: string;
  private readonly internalApiKey: string;
  private readonly sessions = new Map<string, Session>();
  private readonly cleanup = setInterval(() => this.removeExpired(), 10 * 60 * 1000);

  constructor(configService: ConfigService) {
    this.pythonApiUrl = (configService.get<string>('PYTHON_API_URL') || 'http://127.0.0.1:8000').replace(/\/$/, '');
    this.internalApiKey = configService.get<string>('INTERNAL_API_KEY') || '';
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanup);
  }

  /**
   * Sends the question together with the session history to the Python API and yields its events. The complete
   * answer is stored in the history once the stream has finished; a summary replaces the older messages.
   */
  async *streamReply(
    sessionId: string,
    message: string,
    location: { latitude: number; longitude: number } | undefined,
    language: 'de' | 'en' | 'hr' | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const history = this.sessions.get(sessionId)?.history ?? [];
    const response = await fetch(`${this.pythonApiUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': this.internalApiKey },
      body: JSON.stringify({ message, history, location, language }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Python API answered with status ${response.status}`);
    }

    let answer = '';
    let summary: Summary | undefined;
    try {
      for await (const event of this.readEvents(response.body)) {
        if (typeof event.token === 'string') answer += event.token;
        if (event.summary) summary = event.summary as Summary;
        yield event;
      }
    } finally {
      const updated = summary
        ? [{ role: 'system' as const, content: summary.content }, ...history.slice(summary.replacedMessages)]
        : [...history];
      if (answer) updated.push({ role: 'user', content: message }, { role: 'assistant', content: answer });
      this.store(sessionId, updated);
    }
  }

  /** Forwards a recorded question to the Python API (Whisper) and returns the recognised text. */
  async transcribe(audio: Buffer, filename: string, mimeType: string, quality: 'fast' | 'quality'): Promise<Response> {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
    form.append('quality', quality);
    return fetch(`${this.pythonApiUrl}/transcribe`, {
      method: 'POST',
      headers: { 'x-internal-api-key': this.internalApiKey },
      body: form,
    });
  }

  reset(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private store(sessionId: string, history: HistoryMessage[]): void {
    this.sessions.delete(sessionId); // re-insert, so the Map stays ordered by last use
    this.sessions.set(sessionId, { history, lastUsed: Date.now() });
    while (this.sessions.size > MAX_SESSIONS) {
      this.sessions.delete(this.sessions.keys().next().value);
    }
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastUsed > SESSION_TTL_MS) this.sessions.delete(id);
    }
  }

  /** Parses the Python API's SSE stream (`data: {...}` events, ending with `data: [DONE]`). */
  private async *readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const data = event.replace(/^data: /, '');
        if (data === '[DONE]') return;
        yield JSON.parse(data) as ChatEvent;
      }
    }
  }
}
