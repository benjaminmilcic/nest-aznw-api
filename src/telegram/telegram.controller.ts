import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TelegramService } from './telegram.service';

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
  constructor(private readonly telegramService: TelegramService) {}

  @Get('auth/status')
  async getAuthStatus() {
    return this.telegramService.getAuthStatus();
  }

  @Post('auth/send-code')
  async sendCode(@Body() body: { phoneNumber: string }) {
    try {
      return await this.telegramService.sendCode(body.phoneNumber);
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to send code',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/sign-in')
  async signIn(@Body() body: { phoneNumber: string; phoneCode: string }) {
    try {
      return await this.telegramService.signIn(
        body.phoneNumber,
        body.phoneCode,
      );
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Sign in failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/sign-in-2fa')
  async signIn2FA(@Body() body: { password: string }) {
    try {
      return await this.telegramService.signIn2FA(body.password);
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || '2FA failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/logout')
  async logout() {
    await this.telegramService.logout();
    return { status: 'logged_out' };
  }

  @Get('dialogs')
  async getDialogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.ensureConnected();
    return this.telegramService.getDialogs(
      limit ? parseInt(limit) : 30,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('dialogs/:chatId')
  async getDialog(@Param('chatId') chatId: string) {
    this.ensureConnected();
    return this.telegramService.getDialogById(chatId);
  }

  @Delete('dialogs/:chatId')
  async deleteChat(@Param('chatId') chatId: string) {
    this.ensureConnected();
    try {
      await this.telegramService.deleteChat(chatId);
      return { status: 'ok' };
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to delete chat',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('dialogs/:chatId/clear-history')
  async clearHistory(@Param('chatId') chatId: string) {
    this.ensureConnected();
    try {
      await this.telegramService.clearHistory(chatId);
      return { status: 'ok' };
    } catch (error: any) {
      throw new HttpException(
        error.errorMessage || error.message || 'Failed to clear history',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('dialogs/:chatId/block')
  async blockUser(@Param('chatId') chatId: string) {
    this.ensureConnected();
    try {
      await this.telegramService.blockUser(chatId);
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
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offsetId') offsetId?: string,
  ) {
    this.ensureConnected();
    return this.telegramService.getMessages(
      chatId,
      limit ? parseInt(limit) : 30,
      offsetId ? parseInt(offsetId) : undefined,
    );
  }

  @Post('messages/:chatId')
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() body: { text: string },
  ) {
    this.ensureConnected();
    return this.telegramService.sendMessage(chatId, body.text);
  }

  @Post('messages/:chatId/read')
  async markAsRead(@Param('chatId') chatId: string) {
    this.ensureConnected();
    await this.telegramService.markAsRead(chatId);
    return { status: 'ok' };
  }

  @Post('messages/:chatId/file')
  @UseInterceptors(FileInterceptor('file'))
  async sendFile(
    @Param('chatId') chatId: string,
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { caption?: string },
  ) {
    this.ensureConnected();
    return this.telegramService.sendFile(chatId, file, body.caption);
  }

  @Get(['media/:chatId/:messageId', 'media/:chatId/:messageId/:fileName'])
  async downloadMedia(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    this.ensureConnected();
    const meta = await this.telegramService.getMediaMetadata(
      chatId,
      parseInt(messageId),
    );
    if (!meta) {
      throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
    }

    const headers: Record<string, string> = {
      'Content-Type': meta.mimeType,
      'Content-Disposition': `inline; filename="${meta.fileName}"`,
    };
    if (meta.fileSize) {
      headers['Content-Length'] = meta.fileSize;
    }
    res.set(headers);

    for await (const chunk of this.telegramService.iterDownloadMedia(
      meta.inputLocation,
      meta.dcId,
      meta.msgData,
    )) {
      res.write(chunk);
    }
    res.end();
  }

  private ensureConnected(): void {
    if (!this.telegramService.isConnected()) {
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    }
  }
}
