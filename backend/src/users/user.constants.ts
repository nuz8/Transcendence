export const USER_CONSTRAINTS = {
  USERNAME_UNIQUE: 'users_username_active_unique',
  EMAIL_UNIQUE: 'users_email_active_unique',
} as const;

const STATIC_AVATAR_PREFIX = 'api/static/avatars';

export const AVATAR_CONSTANTS = {
  DEFAULT_AVATAR_PATH: `${STATIC_AVATAR_PREFIX}/default.svg`,
  BOT_AVATAR_PATH: `${STATIC_AVATAR_PREFIX}/bot.svg`,
  DELETED_AVATAR_PATH: `${STATIC_AVATAR_PREFIX}/deleted.svg`,
  UPLOAD_DIR_REL: 'public/avatars/uploads',
  UPLOAD_URL_PREFIX: `${STATIC_AVATAR_PREFIX}/uploads`,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
