import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';
import { environment } from '../../environments/environment';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Auth.refresh', () => {
  let httpMock: HttpTestingController;
  let auth: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });

  it('shares a single HTTP call between concurrent callers', async () => {
    let first: string | undefined;
    let second: string | undefined;
    auth.refresh().subscribe((res) => (first = res.access_token));
    auth.refresh().subscribe((res) => (second = res.access_token));

    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'shared-token' });
    await flushPromises();

    expect(first).toBe('shared-token');
    expect(second).toBe('shared-token');
    httpMock.verify();
  });

  it('starts a new call once the previous one has completed', async () => {
    auth.refresh().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'first' });
    await flushPromises();

    auth.refresh().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'second' });
    await flushPromises();

    expect(auth.accessToken()).toBe('second');
    httpMock.verify();
  });

  it('falls back to a direct call when the Web Locks API is unavailable', async () => {
    const original: unknown = (navigator as unknown as Record<string, unknown>)['locks'];
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });

    let result: string | undefined;
    auth.refresh().subscribe((res) => (result = res.access_token));
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'no-lock-token' });
    await flushPromises();

    expect(result).toBe('no-lock-token');
    httpMock.verify();

    Object.defineProperty(navigator, 'locks', { value: original, configurable: true });
  });

  it('serializes the HTTP call through navigator.locks when available', async () => {
    const original: unknown = (navigator as unknown as Record<string, unknown>)['locks'];
    const requestSpy = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    Object.defineProperty(navigator, 'locks', { value: { request: requestSpy }, configurable: true });

    auth.refresh().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'locked-token' });
    await flushPromises();

    expect(requestSpy).toHaveBeenCalledWith('auth-refresh', expect.any(Function));
    httpMock.verify();

    Object.defineProperty(navigator, 'locks', { value: original, configurable: true });
  });
});
