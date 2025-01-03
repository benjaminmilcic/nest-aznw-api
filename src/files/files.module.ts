import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as uuid from 'uuid';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: process.cwd() + '/../guestbookfiles/',
        filename: (req, file, cb) => {
          const extension = file.originalname.includes('.')
            ? file.originalname.substring(file.originalname.lastIndexOf('.'))
            : '';
          const filename = uuid.v4() + extension;
          cb(null, filename);
        },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
