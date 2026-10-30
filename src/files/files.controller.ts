import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { RateLimitGuard } from '../common/rate-limit.guard';

const HOUR_MS = 60 * 60 * 1000;

@Controller('/files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get('/download/:filename')
  getFile(@Param('filename') filename: string): StreamableFile {
    return this.filesService.getFile(filename);
  }

  // Open for the recipe and guestbook gimmicks, but limited per visitor – checked before the file is written
  @Post('/upload')
  @UseGuards(RateLimitGuard('upload', 20, HOUR_MS))
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('An image in the field "file" is required');
    }
    return this.filesService.uploadFile(file);
  }
}
