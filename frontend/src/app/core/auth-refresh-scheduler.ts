import { Injectable, effect, inject } from '@angular/core';
import { Auth } from './auth';
import { getTokenExpiry } from './auth/token-expiry.util';

// Refresh one minute before expiry: leaves time for the request, even when the browser slows down timers in background tabs.
const REFRESH_MARGIN_MS = 60_000;
// Never refresh in a tight loop, e.g. with a very short token lifetime or a client clock ahead of the server.
const MIN_REFRESH_DELAY_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class AuthRefreshScheduler {
  private readonly auth = inject(Auth);

  constructor() {
    // Runs on every new access token (login, startup, 401 retry, scheduled refresh) and on logout.
    effect((onCleanup) => {
      const token = this.auth.accessToken();
      const expiresAt = token ? getTokenExpiry(token) : null;
      if (expiresAt === null) {
        return;
      }

      const delay = Math.max(expiresAt - REFRESH_MARGIN_MS - Date.now(), MIN_REFRESH_DELAY_MS);
      // A failed refresh is left to the existing 401 flow on the next HTTP request.
      const timer = setTimeout(() => this.auth.refresh().subscribe({ error: () => {} }), delay);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
