import { Injectable, signal, inject, computed } from '@angular/core';
import { AuthService, LoginDto, LoginResponseDto, LogoutResponseDto, PublicUserResponseDto, RefreshResponseDto, RegisterDto } from './modules/openapi';
import { Observable, defer, finalize, firstValueFrom, from, map, shareReplay, tap, timeout } from 'rxjs';
import { getTokenSubject } from './auth/token-expiry.util';

const REFRESH_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  readonly userId = computed(() => {
    const token = this._accessToken();
    return token ? getTokenSubject(token) : null;
  });
  private readonly authService = inject(AuthService);
  private refreshInFlight: Observable<RefreshResponseDto> | null = null;
  private readonly channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('auth-changed')
    : null;

  constructor() {
    if (this.channel) {
      this.channel.onmessage = () => window.location.assign('/');
    }
  }

  login(loginDto: LoginDto): Observable<LoginResponseDto> {
    return this.authService.authControllerLogin({ loginDto })
      .pipe(tap((res) => {
        this._accessToken.set(res.access_token);
        this.channel?.postMessage('login');
      }));
  }

  register(registerDto: RegisterDto): Observable<PublicUserResponseDto> {
    return this.authService.authControllerRegister({ registerDto });
  }

  refresh(): Observable<RefreshResponseDto> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const request$ = defer(() =>
      from(
        this.acquireRefreshLock(() =>
          firstValueFrom(this.authService.authControllerRefresh()),
        ),
      ),
    ).pipe(
      timeout(REFRESH_TIMEOUT_MS),
      map((res) => {
        // 204 No Content: no refresh cookie, so there is no session to restore
        if (!res?.access_token) throw new Error('NO_SESSION');
        return res;
      }),
      tap((res) => this._accessToken.set(res.access_token)),
      finalize(() => { this.refreshInFlight = null; }),
      shareReplay(1),
    );

    this.refreshInFlight = request$;
    return request$;
  }

  logout(): Observable<LogoutResponseDto> {
    return this.authService.authControllerLogout()
      .pipe(finalize(() => {
        this._accessToken.set(null);
        this.channel?.postMessage('logout');
      }));
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
