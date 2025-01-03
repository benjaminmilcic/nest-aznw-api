import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { join } from 'path';

@Injectable()
export class FilesService {
  getFile(filename): StreamableFile {
    const file = createReadStream(
      join(process.cwd() + '/../guestbookfiles/', filename),
    );
    return new StreamableFile(file, {
      disposition: 'attachment; filename="' + filename + '"',
    });
  }

  uploadFile(file: Express.Multer.File) {
    return '{"file": "' + file.filename + '"}';
  }
}
