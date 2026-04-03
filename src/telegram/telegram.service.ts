import { Injectable, Logger } from '@nestjs/common';
import { TelegramClient, Api, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent, Raw } from 'telegram/events';
import { computeCheck } from 'telegram/Password';
import { CustomFile } from 'telegram/client/uploads';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

// HINWEIS: Session-Persistenz auf dem Dateisystem wurde aus Sicherheitsgründen deaktiviert.
// Die auskommentierten Imports werden benötigt, wenn die Persistenz wieder aktiviert wird.
// import {
//   existsSync,
//   readFileSync,
//   writeFileSync,
//   mkdirSync,
//   unlinkSync,
//   readdirSync,
// } from 'fs';
// import { join } from 'path';

// Repräsentiert eine aktive Telegram-Verbindung eines Users im Server-Memory.
// Solange der Server läuft, bleiben Sessions hier gespeichert.
// Bei einem Server-Neustart gehen alle Sessions verloren → User muss sich neu einloggen.
interface UserSession {
  client: TelegramClient;
  phoneCodeHash: string | null; // Wird beim Login-Flow (sendCode → signIn) benötigt
  lastActivity: number;         // Unix-Timestamp für inaktive-Session-Cleanup
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  // In-Memory-Map: sessionId (UUID) → aktive TelegramClient-Instanz
  // SICHERHEIT: Sessions werden nicht auf Disk geschrieben, nur hier gehalten.
  private sessions = new Map<string, UserSession>();

  private apiId: number;
  private apiHash: string;

  // HINWEIS: sessionPath wird nur benötigt, wenn Datei-Persistenz aktiv ist.
  // private sessionPath = join(process.cwd() + '/../sessions');

  private cleanupInterval: NodeJS.Timeout;

  // Event-Callbacks pro Session für den WebSocket-Gateway (Echtzeit-Updates)
  private eventCallbacks = new Map<
    string,
    {
      onNewMessage?: (event: NewMessageEvent) => void;
      onReadOutbox?: (chatId: string, maxId: number) => void;
      onOutgoingMessage?: (msg: Api.Message) => void;
    }
  >();

  constructor(private readonly configService: ConfigService) {
    this.apiId = +this.configService.get<string>('TELEGRAM_API_ID') || 0;
    this.apiHash = this.configService.get<string>('TELEGRAM_API_HASH') || '';

    // Inaktive Sessions alle 30 Minuten aus dem Memory räumen
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveSessions(),
      30 * 60 * 1000,
    );
  }

  // Wird beim NestJS-Modul-Shutdown aufgerufen: alle Verbindungen sauber trennen
  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
    for (const [, session] of this.sessions) {
      session.client.disconnect();
    }
  }

  // Prüft ob für eine sessionId eine aktive Telegram-Verbindung im Memory existiert
  isConnected(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.client?.connected ?? false;
  }

  // Gibt den TelegramClient für eine Session zurück und aktualisiert lastActivity
  getClient(sessionId: string): TelegramClient | null {
    const session = this.sessions.get(sessionId);
    if (session) session.lastActivity = Date.now();
    return session?.client ?? null;
  }

  // Erstellt eine neue TelegramClient-Instanz und verbindet sie mit Telegrams MTProto-Servern.
  // Startet immer mit einer leeren Session (kein gespeicherter Auth-State).
  private async initClient(sessionId: string): Promise<TelegramClient> {
    // Leere Session → noch nicht eingeloggt, nur verbunden
    const session = new StringSession('');

    // DATEI-PERSISTENZ (auskommentiert):
    // Wenn Sessions wieder aus Dateien geladen werden sollen, diese Zeilen einkommentieren
    // und den Import-Block oben ebenfalls aktivieren.
    // const sessionString = this.loadSession(sessionId);
    // const session = new StringSession(sessionString);

    const client = new TelegramClient(session, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    // GramJS-eigene Console-Ausgaben deaktivieren; wir nutzen den NestJS-Logger.
    // Ohne _log.setLevel('none') würde updates.js TIMEOUT-Fehler via console.error() ausgeben,
    // obwohl diese kein Absturz sind – GramJS reconnectet danach automatisch.
    (client as any)._log.setLevel('none');
    (client as any)._errorHandler = async (err: Error) => {
      if (err?.message === 'TIMEOUT') {
        this.logger.warn(`Telegram ping timeout für Session ${sessionId}, reconnecting…`);
      } else {
        this.logger.error(`Telegram client error für Session ${sessionId}: ${err?.message}`);
      }
    };

    await client.connect();

    this.sessions.set(sessionId, {
      client,
      phoneCodeHash: null,
      lastActivity: Date.now(),
    });

    this.logger.log(`Telegram client connected for session ${sessionId}`);
    return client;
  }

  // Schritt 1 des Login-Flows: Sendet einen SMS/App-Code an die Telefonnummer.
  // Gibt eine neue sessionId zurück, die der Client für alle weiteren Requests verwenden muss.
  async sendCode(
    phoneNumber: string,
    sessionId?: string,
  ): Promise<{ phoneCodeHash: string; sessionId: string }> {
    // Neue Session anlegen falls noch keine vorhanden
    if (!sessionId) {
      sessionId = randomUUID();
    }

    await this.initClient(sessionId);
    const client = this.sessions.get(sessionId)!.client;

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: this.apiId,
        apiHash: this.apiHash,
        settings: new Api.CodeSettings({}),
      }),
    );

    // phoneCodeHash wird für den nachfolgenden signIn-Aufruf benötigt
    const phoneCodeHash = (result as any).phoneCodeHash;
    this.sessions.get(sessionId)!.phoneCodeHash = phoneCodeHash;

    return { phoneCodeHash, sessionId };
  }

  // Schritt 2 des Login-Flows: Bestätigt den Code und loggt den User ein.
  // Bei aktivierter 2FA gibt es den Status '2fa_required' zurück → dann signIn2FA aufrufen.
  async signIn(
    sessionId: string,
    phoneNumber: string,
    phoneCode: string,
  ): Promise<{ status: string; user?: any }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    try {
      const result = await session.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: session.phoneCodeHash!,
          phoneCode,
        }),
      );

      const user = (result as any).user;

      // DATEI-PERSISTENZ (auskommentiert):
      // this.saveSession(sessionId);

      this.logger.log(
        `Signed in as ${user?.firstName} (session ${sessionId})`,
      );
      return { status: 'success', user: this.formatUser(user) };
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        return { status: '2fa_required' };
      }
      throw error;
    }
  }

  // Schritt 2b (optional): 2-Faktor-Authentifizierung mit Cloud-Passwort
  async signIn2FA(
    sessionId: string,
    password: string,
  ): Promise<{ status: string; user?: any }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const passwordInfo = await session.client.invoke(
      new Api.account.GetPassword(),
    );
    const passwordSrp = await computeCheck(passwordInfo, password);
    const result = await session.client.invoke(
      new Api.auth.CheckPassword({
        password: passwordSrp,
      }),
    );

    const user = (result as any).user;

    // DATEI-PERSISTENZ (auskommentiert):
    // this.saveSession(sessionId);

    this.logger.log(
      `Signed in with 2FA as ${user?.firstName} (session ${sessionId})`,
    );
    return { status: 'success', user: this.formatUser(user) };
  }

  // Prüft ob eine Session noch aktiv/eingeloggt ist.
  // Ohne Datei-Persistenz: gibt false zurück sobald die Session nicht mehr im Memory ist
  // (z.B. nach Server-Neustart oder inaktivem Cleanup).
  async getAuthStatus(
    sessionId: string,
  ): Promise<{ authenticated: boolean; user?: any }> {
    // Prüfe zuerst ob eine aktive Verbindung im Memory existiert
    const existing = this.sessions.get(sessionId);
    if (existing?.client?.connected) {
      try {
        existing.lastActivity = Date.now();
        const me = await existing.client.getMe();
        return { authenticated: true, user: this.formatUser(me) };
      } catch {
        return { authenticated: false };
      }
    }

    // DATEI-PERSISTENZ (auskommentiert):
    // Wenn Sessions aus Dateien wiederhergestellt werden sollen (z.B. nach Server-Neustart),
    // diesen Block einkommentieren. SICHERHEITSHINWEIS: Die Session-Dateien enthalten den
    // vollständigen Telegram-Auth-Token im Klartext. Wer Zugriff auf das Dateisystem hat,
    // kann sich damit als der jeweilige User einloggen.
    //
    // const sessionString = this.loadSession(sessionId);
    // if (sessionString && this.apiId && this.apiHash) {
    //   try {
    //     await this.initClient(sessionId);
    //     const client = this.sessions.get(sessionId)!.client;
    //     const me = await client.getMe();
    //     return { authenticated: true, user: this.formatUser(me) };
    //   } catch {
    //     return { authenticated: false };
    //   }
    // }

    return { authenticated: false };
  }

  // Beendet die Telegram-Session: loggt bei Telegram aus, trennt die Verbindung
  // und entfernt die Session aus dem Memory.
  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.client.invoke(new Api.auth.LogOut());
      } catch {}
      session.client.disconnect();
      this.sessions.delete(sessionId);
      this.eventCallbacks.delete(sessionId);

      // DATEI-PERSISTENZ (auskommentiert):
      // this.deleteSession(sessionId);
    }
  }

  // Gibt Details zu einem einzelnen Chat/Dialog zurück, inklusive Avatar als Base64
  async getDialogById(sessionId: string, chatId: string): Promise<any> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    const inputPeer = await client.getInputEntity(chatId);

    const result = await client.invoke(
      new Api.messages.GetPeerDialogs({
        peers: [new Api.InputDialogPeer({ peer: inputPeer as any })],
      }),
    );

    const dialog = result.dialogs[0] as any;
    const lastMsg = result.messages[0] as any;

    let avatarBase64: string | null = null;
    try {
      const photo = await client.downloadProfilePhoto(entity, {
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

  // Gibt eine paginierte Liste aller Dialoge (Chats, Gruppen, Kanäle) zurück
  async getDialogs(
    sessionId: string,
    limit = 30,
    offset = 0,
  ): Promise<any[]> {
    const client = this.getClient(sessionId)!;
    const dialogs = await client.getDialogs({ limit: limit + offset });
    const sliced = dialogs.slice(offset, offset + limit);

    return Promise.all(
      sliced.map(async (dialog) => {
        let avatarBase64: string | null = null;
        try {
          if (dialog.entity) {
            const photo = await client.downloadProfilePhoto(dialog.entity, {
              isBig: false,
            });
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

  // Gibt Nachrichten eines Chats zurück (paginiert über offsetId)
  async getMessages(
    sessionId: string,
    chatId: string,
    limit = 30,
    offsetId?: number,
  ): Promise<{ messages: any[]; readOutboxMaxId: number }> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    const messages = await client.getMessages(entity, {
      limit,
      offsetId,
    });

    // readOutboxMaxId = die höchste Message-ID, die der Gegenüber gelesen hat
    let readOutboxMaxId = 0;
    try {
      const inputPeer = await client.getInputEntity(chatId);
      const result = await client.invoke(
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

  // Sendet eine Textnachricht an einen Chat
  async sendMessage(
    sessionId: string,
    chatId: string,
    text: string,
  ): Promise<any> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    const result = await client.sendMessage(entity, { message: text });
    return {
      id: result.id,
      text: result.text,
      date: result.date,
      out: true,
    };
  }

  // Sendet eine Datei (Bild, Dokument, etc.) an einen Chat
  async sendFile(
    sessionId: string,
    chatId: string,
    fileData: { buffer: Buffer; originalname: string; mimetype: string },
    caption?: string,
  ): Promise<any> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);

    const customFile = new CustomFile(
      fileData.originalname,
      fileData.buffer.length,
      '',
      fileData.buffer,
    );

    const result = await client.sendFile(entity, {
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

  // Gibt Metadaten einer Medien-Nachricht zurück (für den Streaming-Download benötigt)
  async getMediaMetadata(
    sessionId: string,
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
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    const messages = await client.getMessages(entity, { ids: messageId });
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

  // Streamt Mediendaten in Chunks (256KB) direkt aus Telegrams CDN
  iterDownloadMedia(
    sessionId: string,
    inputLocation: Api.TypeInputFileLocation,
    dcId?: number,
    msgData?: [any, number],
  ) {
    const client = this.getClient(sessionId)!;
    return client.iterDownload({
      file: inputLocation,
      requestSize: 256 * 1024,
      dcId,
      msgData,
    });
  }

  // Löscht einen Chat (Kanal: austreten, sonst: History löschen mit revoke=true für beide Seiten)
  async deleteChat(sessionId: string, chatId: string): Promise<void> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);

    if (entity instanceof Api.Channel) {
      await client.invoke(
        new Api.channels.LeaveChannel({ channel: entity }),
      );
    } else {
      await client.invoke(
        new Api.messages.DeleteHistory({
          peer: entity,
          maxId: 0,
          revoke: true,
        }),
      );
    }
  }

  // Leert den Chat-Verlauf lokal (justClear=true → nur auf dieser Seite, nicht beim Gegenüber)
  async clearHistory(sessionId: string, chatId: string): Promise<void> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    await client.invoke(
      new Api.messages.DeleteHistory({
        peer: entity,
        maxId: 0,
        justClear: true,
      }),
    );
  }

  // Blockiert einen User
  async blockUser(sessionId: string, chatId: string): Promise<void> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    await client.invoke(new Api.contacts.Block({ id: entity }));
  }

  // Markiert alle Nachrichten in einem Chat als gelesen
  async markAsRead(sessionId: string, chatId: string): Promise<void> {
    const client = this.getClient(sessionId)!;
    const entity = await client.getEntity(chatId);
    await client.markAsRead(entity);
  }

  // Registriert einen Handler für eingehende Nachrichten (für WebSocket-Gateway)
  // Ersetzt einen evtl. vorhandenen alten Handler für dieselbe Session
  registerNewMessageHandler(
    sessionId: string,
    callback: (event: NewMessageEvent) => void,
  ): void {
    const client = this.getClient(sessionId);
    if (!client) return;

    const callbacks = this.eventCallbacks.get(sessionId) || {};
    if (callbacks.onNewMessage) {
      client.removeEventHandler(callbacks.onNewMessage, new NewMessage({}));
    }
    callbacks.onNewMessage = callback;
    this.eventCallbacks.set(sessionId, callbacks);
    client.addEventHandler(callback, new NewMessage({}));
    this.logger.log(`Registered new message handler for session ${sessionId}`);
  }

  // Registriert Handler für Raw-Updates: gelesen-Bestätigungen und eigene gesendete Nachrichten
  registerRawUpdateHandler(
    sessionId: string,
    callbacks: {
      onReadOutbox: (chatId: string, maxId: number) => void;
      onOutgoingMessage: (msg: Api.Message) => void;
    },
  ): void {
    const client = this.getClient(sessionId);
    if (!client) return;

    const existing = this.eventCallbacks.get(sessionId) || {};
    existing.onReadOutbox = callbacks.onReadOutbox;
    existing.onOutgoingMessage = callbacks.onOutgoingMessage;
    this.eventCallbacks.set(sessionId, existing);

    client.addEventHandler((update: Api.TypeUpdate) => {
      if (update instanceof Api.UpdateReadHistoryOutbox) {
        const chatId = utils.getPeerId(update.peer).toString();
        callbacks.onReadOutbox(chatId, update.maxId);
      }
      if (update instanceof Api.UpdateReadChannelOutbox) {
        const chatId = '-100' + update.channelId.toString();
        callbacks.onReadOutbox(chatId, update.maxId);
      }

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
    this.logger.log(`Registered raw update handler for session ${sessionId}`);
  }

  // Gibt alle sessionIds zurück, die aktuell eine aktive Telegram-Verbindung haben
  getConnectedSessionIds(): string[] {
    const ids: string[] = [];
    for (const [id, session] of this.sessions) {
      if (session.client?.connected) {
        ids.push(id);
      }
    }
    return ids;
  }

  // Extrahiert Medien-Metadaten aus einer Nachricht (Typ, MIME, Dateiname, Größe)
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

  // Formatiert ein Telegram-User-Objekt auf die relevanten Felder
  private formatUser(user: any): any {
    return {
      id: user?.id?.toString(),
      firstName: user?.firstName,
      lastName: user?.lastName,
      username: user?.username,
      phone: user?.phone,
    };
  }

  // DATEI-PERSISTENZ (auskommentiert):
  // Diese drei Methoden ermöglichen das Speichern/Laden/Löschen von Sessions als .txt-Dateien.
  // SICHERHEITSHINWEIS: Die Dateien enthalten den vollständigen Telegram-Auth-Token im Klartext.
  // Wer Zugriff auf das Dateisystem hat (inkl. Admins), kann sich damit als der User einloggen.
  // Zum Reaktivieren: diese Methoden einkommentieren, den Import-Block oben aktivieren,
  // und die auskommentierten Aufrufe in initClient, signIn, signIn2FA, getAuthStatus und logout einkommentieren.
  //
  // private loadSession(sessionId: string): string {
  //   const filePath = join(this.sessionPath, `${sessionId}.txt`);
  //   if (existsSync(filePath)) {
  //     return readFileSync(filePath, 'utf-8').trim();
  //   }
  //   return '';
  // }
  //
  // private saveSession(sessionId: string): void {
  //   if (!existsSync(this.sessionPath)) {
  //     mkdirSync(this.sessionPath, { recursive: true });
  //   }
  //   const filePath = join(this.sessionPath, `${sessionId}.txt`);
  //   const client = this.sessions.get(sessionId)?.client;
  //   if (client) {
  //     const sessionString = client.session.save() as unknown as string;
  //     writeFileSync(filePath, sessionString);
  //     this.logger.log(`Session saved for ${sessionId}`);
  //   }
  // }
  //
  // private deleteSession(sessionId: string): void {
  //   const filePath = join(this.sessionPath, `${sessionId}.txt`);
  //   if (existsSync(filePath)) {
  //     unlinkSync(filePath);
  //   }
  // }

  // Räumt Sessions auf, die länger als 2 Stunden inaktiv waren
  private cleanupInactiveSessions(): void {
    const maxInactivity = 2 * 60 * 60 * 1000; // 2 Stunden
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > maxInactivity) {
        this.logger.log(`Cleaning up inactive session ${id}`);
        session.client.disconnect();
        this.sessions.delete(id);
        this.eventCallbacks.delete(id);
      }
    }
  }
}
