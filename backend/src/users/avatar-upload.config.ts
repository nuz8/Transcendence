import { BadRequestException } from '@nestjs/common';
import { AVATAR_CONSTANTS } from './user.constants';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const avatarUploadOptions = {
  storage: diskStorage({
  destination: join(process.cwd(), AVATAR_CONSTANTS.UPLOAD_DIR_REL),
  filename: (_req, file, callback) => {
    const ext = MIME_TO_EXT[file.mimetype];
    const uniqueFilename = `${randomUUID()}${ext}`;
    callback(null, uniqueFilename);
  }
  }),
  limits: {
    fileSize: AVATAR_CONSTANTS.MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (
    _req: any,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (
    (AVATAR_CONSTANTS.ALLOWED_MIME_TYPES as readonly string[])
    .includes(file.mimetype)
    ) {
    callback(null, true);
    } else {
    callback(
      new BadRequestException(
      'INVALID_FILE_TYPE: Only JPEG, PNG or WEBP allowed',
      ),
      false,
    );
    }
  },
};