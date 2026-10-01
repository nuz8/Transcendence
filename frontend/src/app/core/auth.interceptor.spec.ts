import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { Auth } from './auth';
import { environment } from '../../environments/environment';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let auth: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    auth = TestBed.inject(Auth);
  });

  function login() {
    auth.login('user@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      user: { id: '1', username: 'u', email: 'user@example.com', avatar: '' },
      access_token: 'fake-token',
    });
  }

  it('does not attach a header when no token is set yet', () => {
    http.get(`${environment.apiUrl}/users/me`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('attaches the Bearer token to requests targeting our API once logged in', () => {
    login();
    http.get(`${environment.apiUrl}/users/me`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({});
    httpMock.verify();
  });

  it('never attaches the token to a request targeting a different origin', () => {
    login();
    http.get('https://third-party.example.com/data').subscribe();
    const req = httpMock.expectOne('https://third-party.example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('retries the original request with a fresh token after a 401', async () => {
    login();

    let result: unknown;
    http.get(`${environment.apiUrl}/protected`).subscribe((res) => (result = res));

    const firstAttempt = httpMock.expectOne(`${environment.apiUrl}/protected`);
    expect(firstAttempt.request.headers.get('Authorization')).toBe('Bearer fake-token');
    firstAttempt.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ access_token: 'refreshed-token' });
    await flushPromises();

    const retry = httpMock.expectOne(`${environment.apiUrl}/protected`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    httpMock.verify();
  });

  it('propagates the original 401 when the refresh token is also invalid', async () => {
    login();

    let error: unknown;
    http.get(`${environment.apiUrl}/protected`).subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(`${environment.apiUrl}/protected`).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { message: 'INVALID_REFRESH_TOKEN' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await flushPromises();

    expect((error as HttpErrorResponse).status).toBe(401);
    httpMock.verify();
  });

  it('does not attempt another refresh when /auth/refresh itself returns 401', async () => {
    login();

    let error: unknown;
    auth.refresh().subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { message: 'INVALID_REFRESH_TOKEN' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await flushPromises();

    expect((error as HttpErrorResponse).status).toBe(401);
    httpMock.verify();
  });

  it('propagates the original 401 when the refresh call hangs past the timeout', async () => {
    vi.useFakeTimers();
    login();

    let error: unknown;
    http.get(`${environment.apiUrl}/protected`).subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(`${environment.apiUrl}/protected`).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`); // never flushed — simulates a hang

    await vi.advanceTimersByTimeAsync(5000);

    expect((error as HttpErrorResponse).status).toBe(401);
    httpMock.verify({ ignoreCancelled: true });

    vi.useRealTimers();
  });
});