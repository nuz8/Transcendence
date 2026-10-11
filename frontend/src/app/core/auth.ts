import { Injectable, signal, inject } from '@angular/core';
import { AuthService, LoginDto, LoginResponseDto, LogoutResponseDto, PublicUserResponseDto, RefreshResponseDto, RegisterDto } from './modules/openapi';
import { Observable, defer, finalize, firstValueFrom, from, shareReplay, tap, timeout } from 'rxjs';

const REFRESH_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  private readonly authService = inject(AuthService);
  private refreshInFlight: Observable<RefreshResponseDto> | null = null;

  login(loginDto: LoginDto): Observable<LoginResponseDto> {
    return this.authService.authControllerLogin({ loginDto })
      .pipe(tap((res) => this._accessToken.set(res.access_token)));
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
      tap((res) => this._accessToken.set(res.access_token)),
      finalize(() => { this.refreshInFlight = null; }),
      shareReplay(1),
    );

    this.refreshInFlight = request$;
    return request$;
  }

  logout(): Observable<LogoutResponseDto> {
    return this.authService.authControllerLogout()
      .pipe(finalize(() => this._accessToken.set(null)));
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
