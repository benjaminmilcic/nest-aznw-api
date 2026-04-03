import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TelegramService } from './telegram.service';
import { TelegramGateway } from './telegram.gateway';

interface UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramGateway: TelegramGateway,
  ) {}

  private getSessionId(headers: Record<string, string>): string {
    const sessionId = headers['x-telegram-session'];
    if (!sessionId) {
      throw new HttpException(
        'Missing x-telegram-session header',
        HttpStatus.BAD_REQUEST,
      );
    }
    return sessionId;
  }

  @Get('auth/status')
  async getAuthStatus(@Headers() headers: Record<string, string>) {
    const sessionId = headers['x-telegram-session'];
    if (!sessionId) {
      return { authenticated: false };
    }
    const status = await this.telegramService.getAuthStatus(sessionId);
    if (status.authenticated) {
      this.telegramGateway.registerHandlerForSession(sessionId);
    }
    return status;
  }

  @Post('auth/send-code')
  async sendCode(
    @Body() body: { phoneNumber: string },
    @Headers() headers: Record<string, string>,
  ) {
    try {
      const sessionId = headers['x-telegram-session'] || undefined;
      return await this.telegramService.sendCode(body.phoneNumber, sessionId);
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to send code',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/sign-in')
  async signIn(
    @Body() body: { phoneNumber: string; phoneCode: string },
    @Headers() headers: Record<string, string>,
  ) {
    const sessionId = this.getSessionId(headers);
    try {
      const result = await this.telegramService.signIn(
        sessionId,
        body.phoneNumber,
        body.phoneCode,
      );
      if (result.status === 'success') {
        this.telegramGateway.registerHandlerForSession(sessionId);
      }
      return result;
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Sign in failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/sign-in-2fa')
  async signIn2FA(
    @Body() body: { password: string },
    @Headers() headers: Record<string, string>,
  ) {
    const sessionId = this.getSessionId(headers);
    try {
      const result = await this.telegramService.signIn2FA(sessionId, body.password);
      if (result.status === 'success') {
        this.telegramGateway.registerHandlerForSession(sessionId);
      }
      return result;
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || '2FA failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/logout')
  async logout(@Headers() headers: Record<string, string>) {
    const sessionId = this.getSessionId(headers);
    await this.telegramService.logout(sessionId);
    return { status: 'logged_out' };
  }

  @Get('dialogs')
  async getDialogs(
    @Headers() headers: Record<string, string>,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.getDialogs(
      sessionId,
      limit ? parseInt(limit) : 30,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('dialogs/:chatId')
  async getDialog(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.getDialogById(sessionId, chatId);
  }

  @Delete('dialogs/:chatId')
  async deleteChat(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    try {
      await this.telegramService.deleteChat(sessionId, chatId);
      return { status: 'ok' };
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to delete chat',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('dialogs/:chatId/clear-history')
  async clearHistory(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    try {
      await this.telegramService.clearHistory(sessionId, chatId);
      return { status: 'ok' };
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to clear history',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('dialogs/:chatId/block')
  async blockUser(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    try {
      await this.telegramService.blockUser(sessionId, chatId);
      return { status: 'ok' };
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to block user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('messages/:chatId')
  async getMessages(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offsetId') offsetId?: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.getMessages(
      sessionId,
      chatId,
      limit ? parseInt(limit) : 30,
      offsetId ? parseInt(offsetId) : undefined,
    );
  }

  @Post('messages/:chatId')
  async sendMessage(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
    @Body() body: { text: string },
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.sendMessage(sessionId, chatId, body.text);
  }

  @Post('messages/:chatId/read')
  async markAsRead(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    await this.telegramService.markAsRead(sessionId, chatId);
    return { status: 'ok' };
  }

  @Post('messages/:chatId/file')
  @UseInterceptors(FileInterceptor('file'))
  async sendFile(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { caption?: string },
  ) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.sendFile(sessionId, chatId, file, body.caption);
  }

  @Post('media/token')
  async createMediaToken(@Headers() headers: Record<string, string>) {
    const sessionId = this.getSessionId(headers);
    this.ensureConnected(sessionId);
    return this.telegramService.createMediaToken(sessionId);
  }

  @Get(['media/:chatId/:messageId', 'media/:chatId/:messageId/:fileName'])
  async downloadMedia(
    @Headers() headers: Record<string, string>,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Query('sessionId') querySessionId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const tokenSessionId = this.telegramService.resolveMediaToken(token);
    if (token && !tokenSessionId) {
      throw new HttpException('Invalid media token', HttpStatus.UNAUTHORIZED);
    }
    const sessionId = tokenSessionId || querySessionId || this.getSessionId(headers);
    this.ensureConnected(sessionId);
    const meta = await this.telegramService.getMediaMetadata(
      sessionId,
      chatId,
      parseInt(messageId),
    );
    if (!meta) {
      throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': meta.mimeType,
      'Content-Disposition': `inline; filename="${meta.fileName}"`,
    };
    if (meta.fileSize) {
      responseHeaders['Content-Length'] = meta.fileSize;
    }
    res.set(responseHeaders);

    for await (const chunk of this.telegramService.iterDownloadMedia(
      sessionId,
      meta.inputLocation,
      meta.dcId,
      meta.msgData,
    )) {
      res.write(chunk);
    }
    res.end();
  }

  private ensureConnected(sessionId: string): void {
    if (!this.telegramService.isConnected(sessionId)) {
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    }
  }
}
