// Returns the `exp` claim of a JWT in milliseconds, or null if it cannot be read.
// The payload is only base64url-encoded, not encrypted: the signature is checked by the backend, not here.
export function getTokenExpiry(token: string): number | null {
  const exp = readTokenPayload(token)?.['exp'];
  return typeof exp === 'number' ? exp * 1000 : null;  
}

export function getTokenSubject(token: string): string | null {
  const sub = readTokenPayload(token)?.['sub'];
  return typeof sub === 'string' ? sub : null;
}

function readTokenPayload(token: string): Record<string,unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
