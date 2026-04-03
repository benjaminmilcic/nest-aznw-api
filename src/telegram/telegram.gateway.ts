import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TelegramService } from './telegram.service';
import { NewMessageEvent } from 'telegram/events';
import { utils } from 'telegram';

@WebSocketGateway({
  namespace: '/telegramws',
  cors: { origin: '*' },
  credentials: true,
})
export class TelegramGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TelegramGateway.name);
  private registeredSessions = new Set<string>();
  private sessionKeepAliveIntervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly telegramService: TelegramService) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    const sessionId = client.handshake.query['sessionId'] as string;
    if (!sessionId) {
      this.logger.warn(`Client ${client.id} connected without sessionId`);
      client.disconnect();
      return;
    }

    client.join(sessionId);
    this.logger.log(
      `Client ${client.id} connected (session ${sessionId})`,
    );

    this.telegramService.touchSession(sessionId);
    if (!this.sessionKeepAliveIntervals.has(sessionId)) {
      const interval = setInterval(
        () => this.telegramService.touchSession(sessionId),
        60 * 1000,
      );
      this.sessionKeepAliveIntervals.set(sessionId, interval);
    }

    // Register Telegram event handlers for this session if not already done
    if (
      !this.registeredSessions.has(sessionId) &&
      this.telegramService.isConnected(sessionId)
    ) {
      this.registerHandlerForSession(sessionId);
    }
  }

  handleDisconnect(client: Socket): void {
    const sessionId = client.handshake.query['sessionId'] as string;
    this.logger.log(
      `Client ${client.id} disconnected (session ${sessionId})`,
    );

    // If no more clients in the room, unregister
    if (sessionId) {
      const room = (this.server.adapter as any).rooms?.get(sessionId);
      if (!room || room.size === 0) {
        this.registeredSessions.delete(sessionId);
        const interval = this.sessionKeepAliveIntervals.get(sessionId);
        if (interval) {
          clearInterval(interval);
          this.sessionKeepAliveIntervals.delete(sessionId);
        }
        this.telegramService.unregisterHandlers(sessionId);
      }
    }
  }

  registerHandlerForSession(sessionId: string): void {
    if (this.registeredSessions.has(sessionId)) return;
    if (!this.telegramService.isConnected(sessionId)) return;

    this.registeredSessions.add(sessionId);

    this.telegramService.registerNewMessageHandler(
      sessionId,
      async (event: NewMessageEvent) => {
        const msg = event.message;
        let senderName = 'Unknown';
        let senderId: string | null = null;

        try {
          const sender = await msg.getSender();
          if (sender) {
            senderId = sender.id?.toString() ?? null;
            senderName =
              (sender as any).firstName ?? (sender as any).title ?? 'Unknown';
            if ((sender as any).lastName) {
              senderName += ` ${(sender as any).lastName}`;
            }
          }
        } catch {}

        const mediaInfo = msg.media
          ? await this.telegramService.extractMediaInfo(msg)
          : null;

        let chatId = msg.chatId?.toString();
        if (!chatId && msg.peerId) {
          const peer = msg.peerId as any;
          chatId = (peer.userId ?? peer.chatId ?? peer.channelId)?.toString();
        }

        // Emit only to clients in this session's room
        this.server.to(sessionId).emit('newMessage', {
          id: msg.id,
          text: msg.text || '',
          date: msg.date,
          out: msg.out,
          chatId,
          senderId,
          senderName,
          media: mediaInfo,
        });
      },
    );

    this.telegramService.registerRawUpdateHandler(sessionId, {
      onReadOutbox: (chatId: string, maxId: number) => {
        this.server.to(sessionId).emit('readHistory', { chatId, maxId });
      },
      onOutgoingMessage: async (msg) => {
        let chatId = msg.chatId?.toString();
        if (!chatId && msg.peerId) {
          chatId = utils.getPeerId(msg.peerId).toString();
        }

        const mediaInfo = msg.media
          ? await this.telegramService.extractMediaInfo(msg)
          : null;

        this.server.to(sessionId).emit('newMessage', {
          id: msg.id,
          text: msg.text || '',
          date: msg.date,
          out: true,
          chatId,
          senderId: null,
          senderName: 'Du',
          media: mediaInfo,
        });
      },
    });

    this.logger.log(`Telegram event handler registered for session ${sessionId}`);
  }
}
