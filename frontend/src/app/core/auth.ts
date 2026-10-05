import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, finalize, firstValueFrom, from, shareReplay, tap, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, RefreshResponse, LogoutResponse, LoginData, RegisterData, RegisterResponse } from './auth/auth.models'

const REFRESH_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  private readonly http = inject(HttpClient);
  private refreshInFlight: Observable<RefreshResponse> | null = null;

  login(credentials: LoginData): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        credentials,
        { withCredentials: true },
      )
      .pipe(tap((res) => this._accessToken.set(res.access_token)));
  }

  register(data: RegisterData): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, data);
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

  isLoggedIn(): boolean {
    return !!this._accessToken();
  }

  private acquireRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    if (typeof navigator?.locks?.request !== 'function') {
      return task();
    }
    return navigator.locks.request('auth-refresh', task);
  }
}
