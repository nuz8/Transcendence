// Returns the `exp` claim of a JWT in milliseconds, or null if it cannot be read.
// The payload is only base64url-encoded, not encrypted: the signature is checked by the backend, not here.
export function getTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
