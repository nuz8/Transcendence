import { describe, it, expect } from 'vitest';
import { getTokenExpiry } from './token-expiry.util';

function fakeJwt(payload: object): string {
  const base64url = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64url}.signature`;
}

describe('getTokenExpiry', () => {
  it('returns the exp claim in milliseconds', () => {
    expect(getTokenExpiry(fakeJwt({ sub: 'user-1', exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it('decodes base64url payloads', () => {
    // '???' encodes to a '/' in base64, i.e. a '_' in base64url
    const token = fakeJwt({ sub: '???', exp: 1_700_000_000 });
    expect(token).toContain('_');
    expect(getTokenExpiry(token)).toBe(1_700_000_000_000);
  });

  it('returns null when there is no exp claim', () => {
    expect(getTokenExpiry(fakeJwt({ sub: 'user-1' }))).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(getTokenExpiry('not-a-jwt')).toBeNull();
    expect(getTokenExpiry('header.%%%.signature')).toBeNull();
  });
});
