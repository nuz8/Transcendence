import { vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Auth } from './auth';
import { AuthRefreshScheduler } from './auth-refresh-scheduler';

function tokenExpiringIn(ms: number): string {
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp: (Date.now() + ms) / 1000 }));
  return `header.${payload}.signature`;
}

describe('AuthRefreshScheduler', () => {
  let accessToken: WritableSignal<string | null>;
  let refresh: ReturnType<typeof vi.fn>;

  function setToken(token: string | null): void {
    accessToken.set(token);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    accessToken = signal<string | null>(null);
    refresh = vi.fn(() => of({ access_token: 'renewed' }));

    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { accessToken, refresh } }],
    });
    TestBed.inject(AuthRefreshScheduler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes 60 s before the token expires, not earlier', () => {
    setToken(tokenExpiringIn(10 * 60_000));

    vi.advanceTimersByTime(9 * 60_000 - 1);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reschedules when a new token arrives', () => {
    setToken(tokenExpiringIn(10 * 60_000));
    setToken(tokenExpiringIn(20 * 60_000));

    vi.advanceTimersByTime(9 * 60_000);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits a minimum delay when the token is about to expire', () => {
    setToken(tokenExpiringIn(30_000));

    vi.advanceTimersByTime(4_999);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops refreshing after logout', () => {
    setToken(tokenExpiringIn(10 * 60_000));
    setToken(null);

    vi.advanceTimersByTime(60 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
