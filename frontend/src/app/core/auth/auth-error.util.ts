import { HttpErrorResponse } from '@angular/common/http';

// Maps the `reason` codes returned by the backend (see backend/src/auth/auth.service.ts) to user-facing messages.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  USERNAME_ALREADY_EXISTS: 'That username is already taken.',
  EMAIL_ALREADY_EXISTS: 'An account with that email already exists.',
};

const DEFAULT_AUTH_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return DEFAULT_AUTH_ERROR_MESSAGE;
  }

  const reason = error.error?.message;
  if (typeof reason === 'string' && reason in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[reason];
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}
