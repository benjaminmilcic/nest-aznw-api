import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { FILES_DIR } from './files.config';

/** A plain file name like the upload creates (UUID plus extension) – no path parts like ../ */
const PLAIN_FILE_NAME = /^[\w-]+(\.\w+)?$/;

@Injectable()
export class FilesService {
  getFile(filename: string): StreamableFile {
    // Checked here, not left to the proxy in front, which happens to block encoded slashes
    if (!PLAIN_FILE_NAME.test(filename) || !existsSync(join(FILES_DIR, filename))) {
      throw new NotFoundException();
    }
    const file = createReadStream(join(FILES_DIR, filename));
    // "attachment": an uploaded file never renders as a page of this origin
    return new StreamableFile(file, {
      disposition: 'attachment; filename="' + filename + '"',
    });
  }

  uploadFile(file: Express.Multer.File) {
    return '{"file": "' + file.filename + '"}';
  }
}
