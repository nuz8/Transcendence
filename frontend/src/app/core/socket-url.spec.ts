import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSocketUrl } from './socket-url';

describe('getSocketUrl', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        protocol: 'https:',
        host: '192.168.0.2',
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('builds a secure wss URL matching current host under /api', () => {
    expect(getSocketUrl('/games/rps')).toBe('wss://192.168.0.2/api/games/rps');
    expect(getSocketUrl('/chat')).toBe('wss://192.168.0.2/api/chat');
  });

  it('handles paths without leading slash', () => {
    expect(getSocketUrl('games/rps')).toBe('wss://192.168.0.2/api/games/rps');
  });

  it('falls back to ws: when page is loaded over http:', () => {
    window.location.protocol = 'http:';
    expect(getSocketUrl('/chat')).toBe('ws://192.168.0.2/api/chat');
  });
});