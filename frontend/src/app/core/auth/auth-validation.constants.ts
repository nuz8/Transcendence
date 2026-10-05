// Mirrors backend/src/auth/auth.constants.ts
export const AUTH_VALID_RULES = {
  USERNAME: {
    MIN: 3,
    MAX: 32,
  },
  PASSWORD: {
    MIN: 8,
    MAX: 72,
  },
} as const;
