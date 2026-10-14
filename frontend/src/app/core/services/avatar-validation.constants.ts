// Mirrors backend/src/users/user.constants.ts AVATAR_CONSTANTS
export const AVATAR_VALID_RULES = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
