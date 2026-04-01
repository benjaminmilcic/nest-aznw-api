import { Injectable, Logger } from '@nestjs/common';
import { TelegramClient, Api, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent, Raw } from 'telegram/events';
import { computeCheck } from 'telegram/Password';
import { CustomFile } from 'telegram/client/uploads';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private client: TelegramClient | null = null;
  private apiId: number;
  private apiHash: string;
  private sessionPath = join(process.cwd() + '/../sessions');
  private phoneCodeHash: string | null = null;
  private onNewMessage: ((event: NewMessageEvent) => void) | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiId = +this.configService.get<string>('TELEGRAM_API_ID') || 0;
    this.apiHash = this.configService.get<string>('TELEGRAM_API_HASH') || '';
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  getClient(): TelegramClient | null {
    return this.client;
  }

  async initClient(): Promise<void> {
    const sessionString = this.loadSession();
    const session = new StringSession(sessionString);

    this.client = new TelegramClient(session, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    await this.client.connect();
    this.logger.log('Telegram client connected');
  }

  async sendCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
    await this.initClient();

    const result = await this.client!.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId:this.apiId,
        apiHash:this.apiHash,
        settings: new Api.CodeSettings({}),
      }),
    );

    this.phoneCodeHash = (result as any).phoneCodeHash;
    return { phoneCodeHash: this.phoneCodeHash! };
  }

  async signIn(
    phoneNumber: string,
    phoneCode: string,
  ): Promise<{ status: string; user?: any }> {
    try {
      const result = await this.client!.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: this.phoneCodeHash!,
          phoneCode,
        }),
      );

      const user = (result as any).user;
      this.saveSession();
      this.logger.log(`Signed in as ${user?.firstName}`);
      return { status: 'success', user: this.formatUser(user) };
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        return { status: '2fa_required' };
      }
      throw error;
    }
  }

  async signIn2FA(password: string): Promise<{ status: string; user?: any }> {
    const passwordInfo = await this.client!.invoke(
      new Api.account.GetPassword(),
    );
    const passwordSrp = await computeCheck(passwordInfo, password);
    const result = await this.client!.invoke(
      new Api.auth.CheckPassword({
        password: passwordSrp,
      }),
    );

    const user = (result as any).user;
    this.saveSession();
    this.logger.log(`Signed in with 2FA as ${user?.firstName}`);
    return { status: 'success', user: this.formatUser(user) };
  }

  async getAuthStatus(): Promise<{ authenticated: boolean; user?: any }> {
    if (!this.client?.connected) {
      // Try to restore session
      const sessionString = this.loadSession();
      if (sessionString) {
        if (this.apiId && this.apiHash) {
          try {
            await this.initClient();
            const me = await this.client!.getMe();
            return { authenticated: true, user: this.formatUser(me) };
          } catch {
            return { authenticated: false };
          }
        }
      }
      return { authenticated: false };
    }

    try {
      const me = await this.client.getMe();
      return { authenticated: true, user: this.formatUser(me) };
    } catch {
      return { authenticated: false };
    }
  }

  async logout(): Promise<void> {
    if (this.client) {
      await this.client.invoke(new Api.auth.LogOut());
      this.client = null;
      this.deleteSession();
    }
  }

  async getDialogById(chatId: string): Promise<any> {
    const entity = await this.client!.getEntity(chatId);
    const inputPeer = await this.client!.getInputEntity(chatId);

    const result = await this.client!.invoke(
      new Api.messages.GetPeerDialogs({
        peers: [new Api.InputDialogPeer({ peer: inputPeer as any })],
      }),
    );

    const dialog = result.dialogs[0] as any;
    const lastMsg = result.messages[0] as any;

    let avatarBase64: string | null = null;
    try {
      const photo = await this.client!.downloadProfilePhoto(entity, {
        isBig: false,
      });
      if (photo && Buffer.isBuffer(photo)) {
        avatarBase64 = `data:image/jpeg;base64,${photo.toString('base64')}`;
      }
    } catch {}

    let title = 'Unknown';
    let isGroup = false;
    let isChannel = false;

    if (entity instanceof Api.User) {
      title =
        [entity.firstName, entity.lastName].filter(Boolean).join(' ') ||
        'Unknown';
    } else if (entity instanceof Api.Chat) {
      title = entity.title || 'Unknown';
      isGroup = true;
    } else if (entity instanceof Api.Channel) {
      title = entity.title || 'Unknown';
      isChannel = !entity.megagroup;
      isGroup = !!entity.megagroup;
    }

    return {
      id: chatId,
      title,
      unreadCount: dialog?.unreadCount ?? 0,
      lastMessage: lastMsg?.message || '',
      lastMessageDate: lastMsg?.date || 0,
      lastMessageOut: lastMsg?.out ?? false,
      lastMessageId: lastMsg?.id ?? 0,
      readOutboxMaxId: dialog?.readOutboxMaxId ?? 0,
      isGroup,
      isChannel,
      avatar: avatarBase64,
    };
  }

  async getDialogs(limit = 30, offset = 0): Promise<any[]> {
    const dialogs = await this.client!.getDialogs({ limit: limit + offset });
    const sliced = dialogs.slice(offset, offset + limit);

    return Promise.all(
      sliced.map(async (dialog) => {
        let avatarBase64: string | null = null;
        try {
          if (dialog.entity) {
            const photo = await this.client!.downloadProfilePhoto(
              dialog.entity,
              {
                isBig: false,
              },
            );
            if (photo && Buffer.isBuffer(photo)) {
              avatarBase64 = `data:image/jpeg;base64,${photo.toString('base64')}`;
            }
          }
        } catch {}

        return {
          id: dialog.id?.toString(),
          title: dialog.title || 'Unknown',
          unreadCount: dialog.unreadCount,
          lastMessage: dialog.message?.text || '',
          lastMessageDate: dialog.message?.date,
          lastMessageOut: dialog.message?.out ?? false,
          lastMessageId: dialog.message?.id ?? 0,
          readOutboxMaxId: (dialog.dialog as any)?.readOutboxMaxId ?? 0,
          isGroup: dialog.isGroup,
          isChannel: dialog.isChannel,
          avatar: avatarBase64,
        };
      }),
    );
  }

  async getMessages(
    chatId: string,
    limit = 30,
    offsetId?: number,
  ): Promise<{ messages: any[]; readOutboxMaxId: number }> {
    const entity = await this.client!.getEntity(chatId);
    const messages = await this.client!.getMessages(entity, {
      limit,
      offsetId,
    });

    let readOutboxMaxId = 0;
    try {
      const inputPeer = await this.client!.getInputEntity(chatId);
      const result = await this.client!.invoke(
        new Api.messages.GetPeerDialogs({
          peers: [new Api.InputDialogPeer({ peer: inputPeer as any })],
        }),
      );
      readOutboxMaxId = (result.dialogs[0] as any)?.readOutboxMaxId ?? 0;
    } catch {}

    const mappedMessages = await Promise.all(
      messages.map(async (msg) => {
        let mediaInfo: any = null;

        if (msg.media) {
          mediaInfo = await this.extractMediaInfo(msg);
        }

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

        return {
          id: msg.id,
          text: msg.text || '',
          date: msg.date,
          out: msg.out,
          senderId,
          senderName,
          media: mediaInfo,
          replyToMsgId: msg.replyTo?.replyToMsgId,
        };
      }),
    );

    return { messages: mappedMessages, readOutboxMaxId };
  }

  async sendMessage(chatId: string, text: string): Promise<any> {
    const entity = await this.client!.getEntity(chatId);
    const result = await this.client!.sendMessage(entity, { message: text });
    return {
      id: result.id,
      text: result.text,
      date: result.date,
      out: true,
    };
  }

  async sendFile(
    chatId: string,
    fileData: { buffer: Buffer; originalname: string; mimetype: string },
    caption?: string,
  ): Promise<any> {
    const entity = await this.client!.getEntity(chatId);

    const customFile = new CustomFile(
      fileData.originalname,
      fileData.buffer.length,
      '',
      fileData.buffer,
    );

    const result = await this.client!.sendFile(entity, {
      file: customFile,
      caption: caption || '',
      forceDocument: !fileData.mimetype.startsWith('image/'),
    });

    return {
      id: result.id,
      text: result.text,
      date: result.date,
      out: true,
    };
  }

  async getMediaMetadata(
    chatId: string,
    messageId: number,
  ): Promise<{
    mimeType: string;
    fileName: string;
    fileSize?: string;
    inputLocation: Api.TypeInputFileLocation;
    dcId?: number;
    msgData?: [any, number];
  } | null> {
    const entity = await this.client!.getEntity(chatId);
    const messages = await this.client!.getMessages(entity, { ids: messageId });
    const msg = messages[0];

    if (!msg?.media) return null;

    if (msg.media instanceof Api.MessageMediaPhoto) {
      const photo = msg.media.photo;
      if (!(photo instanceof Api.Photo)) return null;

      const photoSizes = [...(photo.sizes || []), ...(photo.videoSizes || [])];
      const downloadable = photoSizes.filter(
        (s) =>
          s instanceof Api.PhotoSize || s instanceof Api.PhotoSizeProgressive,
      );
      if (downloadable.length === 0) return null;

      const size = downloadable[downloadable.length - 1];
      const fileSize =
        size instanceof Api.PhotoSizeProgressive
          ? Math.max(...size.sizes)
          : (size as Api.PhotoSize).size;

      return {
        mimeType: 'image/jpeg',
        fileName: `photo_${messageId}.jpg`,
        fileSize: fileSize.toString(),
        inputLocation: new Api.InputPhotoFileLocation({
          id: photo.id,
          accessHash: photo.accessHash,
          fileReference: photo.fileReference,
          thumbSize: 'type' in size ? size.type : '',
        }),
        dcId: photo.dcId,
      };
    }

    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document;
      if (!(doc instanceof Api.Document)) return null;

      const mimeType = doc.mimeType || 'application/octet-stream';
      const fileNameAttr = doc.attributes.find(
        (a) => a instanceof Api.DocumentAttributeFilename,
      ) as Api.DocumentAttributeFilename | undefined;
      const fileName = fileNameAttr?.fileName || `file_${messageId}`;

      return {
        mimeType,
        fileName,
        fileSize: doc.size?.toString(),
        inputLocation: new Api.InputDocumentFileLocation({
          id: doc.id,
          accessHash: doc.accessHash,
          fileReference: doc.fileReference,
          thumbSize: '',
        }),
        dcId: doc.dcId,
        msgData: msg.inputChat ? [msg.inputChat, msg.id] : undefined,
      };
    }

    return null;
  }

  iterDownloadMedia(
    inputLocation: Api.TypeInputFileLocation,
    dcId?: number,
    msgData?: [any, number],
  ) {
    return this.client!.iterDownload({
      file: inputLocation,
      requestSize: 256 * 1024,
      dcId,
      msgData,
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    const entity = await this.client!.getEntity(chatId);

    if (entity instanceof Api.Channel) {
      await this.client!.invoke(
        new Api.channels.LeaveChannel({ channel: entity }),
      );
    } else {
      await this.client!.invoke(
        new Api.messages.DeleteHistory({
          peer: entity,
          maxId: 0,
          revoke: true,
        }),
      );
    }
  }

  async clearHistory(chatId: string): Promise<void> {
    const entity = await this.client!.getEntity(chatId);
    await this.client!.invoke(
      new Api.messages.DeleteHistory({
        peer: entity,
        maxId: 0,
        justClear: true,
      }),
    );
  }

  async blockUser(chatId: string): Promise<void> {
    const entity = await this.client!.getEntity(chatId);
    await this.client!.invoke(new Api.contacts.Block({ id: entity }));
  }

  async markAsRead(chatId: string): Promise<void> {
    const entity = await this.client!.getEntity(chatId);
    await this.client!.markAsRead(entity);
  }

  registerNewMessageHandler(callback: (event: NewMessageEvent) => void): void {
    if (this.onNewMessage) {
      this.client?.removeEventHandler(this.onNewMessage, new NewMessage({}));
    }
    this.onNewMessage = callback;
    this.client?.addEventHandler(callback, new NewMessage({}));
    this.logger.log('Registered new message handler');
  }

  registerRawUpdateHandler(callbacks: {
    onReadOutbox: (chatId: string, maxId: number) => void;
    onOutgoingMessage: (msg: Api.Message) => void;
  }): void {
    this.client?.addEventHandler((update: Api.TypeUpdate) => {
      // Read history updates
      if (update instanceof Api.UpdateReadHistoryOutbox) {
        const chatId = utils.getPeerId(update.peer).toString();
        callbacks.onReadOutbox(chatId, update.maxId);
      }
      if (update instanceof Api.UpdateReadChannelOutbox) {
        const chatId = '-100' + update.channelId.toString();
        callbacks.onReadOutbox(chatId, update.maxId);
      }

      // Outgoing messages from other devices
      if (
        update instanceof Api.UpdateNewMessage ||
        update instanceof Api.UpdateNewChannelMessage
      ) {
        const msg = update.message;
        if (msg instanceof Api.Message && msg.out) {
          callbacks.onOutgoingMessage(msg);
        }
      }
    }, new Raw({}));
    this.logger.log('Registered raw update handler');
  }

  async extractMediaInfo(msg: Api.Message): Promise<any> {
    const media = msg.media;

    if (media instanceof Api.MessageMediaPhoto) {
      return {
        type: 'photo',
        hasMedia: true,
      };
    }

    if (media instanceof Api.MessageMediaDocument) {
      const doc = media.document;
      if (doc instanceof Api.Document) {
        const isSticker = doc.attributes.some(
          (a) => a instanceof Api.DocumentAttributeSticker,
        );
        const isVideo = doc.mimeType?.startsWith('video/');
        const isAudio = doc.mimeType?.startsWith('audio/');
        const fileNameAttr = doc.attributes.find(
          (a) => a instanceof Api.DocumentAttributeFilename,
        ) as Api.DocumentAttributeFilename | undefined;

        return {
          type: isSticker
            ? 'sticker'
            : isVideo
              ? 'video'
              : isAudio
                ? 'audio'
                : 'document',
          mimeType: doc.mimeType,
          size: doc.size?.toString(),
          fileName: fileNameAttr?.fileName,
          hasMedia: true,
        };
      }
    }

    if (media instanceof Api.MessageMediaWebPage) {
      return {
        type: 'webpage',
        hasMedia: false,
      };
    }

    return {
      type: 'unknown',
      hasMedia: !!media,
    };
  }

  private formatUser(user: any): any {
    return {
      id: user?.id?.toString(),
      firstName: user?.firstName,
      lastName: user?.lastName,
      username: user?.username,
      phone: user?.phone,
    };
  }

  private loadSession(): string {
    const filePath = join(this.sessionPath, 'session.txt');
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8').trim();
    }
    return '';
  }

  private saveSession(): void {
    if (!existsSync(this.sessionPath)) {
      mkdirSync(this.sessionPath, { recursive: true });
    }
    const filePath = join(this.sessionPath, 'session.txt');
    const sessionString = this.client!.session.save() as unknown as string;
    writeFileSync(filePath, sessionString);
    this.logger.log('Session saved');
  }

  private deleteSession(): void {
    const filePath = join(this.sessionPath, 'session.txt');
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}
