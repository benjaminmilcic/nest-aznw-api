import { Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as uuid from 'uuid';
import { FILES_DIR, IMAGE_EXTENSIONS, MAX_UPLOAD_BYTES } from './files.config';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: FILES_DIR,
        // The extension comes from the checked file type, never from the name the uploader sent
        filename: (req, file, cb) => cb(null, uuid.v4() + IMAGE_EXTENSIONS[file.mimetype]),
      }),
      // The upload directory shares its disk with the database and its backups – no unlimited uploads
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      // Recipe and guestbook pictures only
      fileFilter: (req, file, cb) => {
        if (IMAGE_EXTENSIONS[file.mimetype]) {
          cb(null, true);
        } else {
          cb(new UnsupportedMediaTypeException('Only JPEG, PNG, WebP and GIF images can be uploaded'), false);
        }
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
