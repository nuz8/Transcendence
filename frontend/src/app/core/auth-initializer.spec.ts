import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { initAuth } from './auth-initializer';
import { Auth } from './auth';
import { provideApi } from './modules/openapi';
import { environment } from '../../environments/environment';

describe('initAuth', () => {
  let httpMock: HttpTestingController;
  let auth: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi({ basePath: environment.apiUrl, withCredentials: true }),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });

  it('sets the access token when a valid refresh cookie exists', async () => {
    const promise = TestBed.runInInjectionContext(() => initAuth());
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'fresh-token' });
    await promise;
    expect(auth.accessToken()).toBe('fresh-token');
    httpMock.verify();
  });

  it('resolves without throwing when there is no valid refresh cookie', async () => {
    const promise = TestBed.runInInjectionContext(() => initAuth());
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { message: 'INVALID_REFRESH_TOKEN' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expect(promise).resolves.toBeNull();
    expect(auth.accessToken()).toBeNull();
    httpMock.verify();
  });

  it('resolves without throwing when the refresh request hangs past the timeout', async () => {
    vi.useFakeTimers();

    const promise = TestBed.runInInjectionContext(() => initAuth());
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`); // never flushed — simulates a hang

    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toBeNull();
    expect(auth.accessToken()).toBeNull();

    // timeout() unsubscribes from the request, so the testing backend marks it
    // "cancelled" instead of leaving it open — tell verify() to accept that.
    httpMock.verify({ ignoreCancelled: true });

    vi.useRealTimers();
  });
});
