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
  namespace: '/telegram',
  cors: { origin: '*' },
  credentials: true,
})
export class TelegramGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TelegramGateway.name);

  constructor(private readonly telegramService: TelegramService) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
    this.setupTelegramEventHandler();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private setupTelegramEventHandler(): void {
    // Re-register every 5 seconds until client is connected
    const interval = setInterval(() => {
      if (this.telegramService.isConnected()) {
        this.registerHandler();
        clearInterval(interval);
      }
    }, 5000);
  }

  private registerHandler(): void {
    this.telegramService.registerNewMessageHandler(
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

        this.server.emit('newMessage', {
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

    this.telegramService.registerRawUpdateHandler({
      onReadOutbox: (chatId: string, maxId: number) => {
        this.server.emit('readHistory', { chatId, maxId });
      },
      onOutgoingMessage: async (msg) => {
        let chatId = msg.chatId?.toString();
        if (!chatId && msg.peerId) {
          chatId = utils.getPeerId(msg.peerId).toString();
        }

        const mediaInfo = msg.media
          ? await this.telegramService.extractMediaInfo(msg)
          : null;

        this.server.emit('newMessage', {
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

    this.logger.log('Telegram event handler registered');
  }
}
