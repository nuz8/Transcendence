import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, finalize, firstValueFrom, from, shareReplay, tap, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

const REFRESH_TIMEOUT_MS = 5000;

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

interface LoginResponse {
  user: User;
  access_token: string;
}

interface RefreshResponse {
  access_token: string;
}

interface LogoutResponse {
  success: boolean;
  refresh_token_revoked?: boolean;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  private readonly http = inject(HttpClient);
  private refreshInFlight: Observable<RefreshResponse> | null = null;

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this._accessToken.set(res.access_token)));
  }

  refresh(): Observable<RefreshResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const request$ = defer(() =>
      from(
        this.acquireRefreshLock(() =>
          firstValueFrom(
            this.http.post<RefreshResponse>(
              `${environment.apiUrl}/auth/refresh`,
              {},
              { withCredentials: true },
            ),
          ),
        ),
      ),
    ).pipe(
      timeout(REFRESH_TIMEOUT_MS),
      tap((res) => this._accessToken.set(res.access_token)),
      finalize(() => { this.refreshInFlight = null; }),
      shareReplay(1),
    );

    this.refreshInFlight = request$;
    return request$;
  }

  logout(): Observable<LogoutResponse> {
    const token = this._accessToken();
    return this.http
      .post<LogoutResponse>(
        `${environment.apiUrl}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      .pipe(tap(() => this._accessToken.set(null)));
  }

  private acquireRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    if (typeof navigator?.locks?.request !== 'function') {
      return task();
    }
    return navigator.locks.request('auth-refresh', task);
  }
}
