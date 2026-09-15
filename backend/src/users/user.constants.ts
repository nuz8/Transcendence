export const USER_CONSTRAINTS = {
  USERNAME_UNIQUE: 'users_username_active_unique',
  EMAIL_UNIQUE: 'users_email_active_unique',
} as const;

export const AVATAR_CONSTANTS = {
  DEFAULT_AVATAR_PATH: '/static/avatars/default.svg',
  UPLOAD_DIR_REL: 'public/avatars/uploads',
  UPLOAD_URL_PREFIX: '/static/avatars/uploads',
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
