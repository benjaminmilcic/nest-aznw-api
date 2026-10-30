import { join } from 'path';

/** Where uploaded pictures (recipes, guestbook) are stored – FILES_DIR overrides it, e.g. in tests */
export const FILES_DIR = process.env.FILES_DIR || join(process.cwd(), '..', 'guestbookfiles');

/** The cropped recipe pictures are about 110 KB – 5 MB leaves plenty of room for photos in the guestbook */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Allowed image types and the extension the stored file gets */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
