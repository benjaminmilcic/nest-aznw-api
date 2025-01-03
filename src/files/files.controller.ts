import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

@Controller('/files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get('/download/:filename')
  getFile(@Param() params: any): StreamableFile {
    return this.filesService.getFile(params.filename);
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.filesService.uploadFile(file);
  }
}
