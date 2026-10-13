import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideApi } from './core/modules/openapi';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { initAuth } from './core/auth-initializer';
import { AuthRefreshScheduler } from './core/auth-refresh-scheduler';
import { environment } from '../environments/environment';
import { PresenceSocket } from './core/presence-socket';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideApi({
      basePath: environment.apiUrl,
      withCredentials: true,
    }),
    provideAppInitializer(initAuth),
    provideAppInitializer(() => { inject(AuthRefreshScheduler); }),
    provideAppInitializer(() => { inject(PresenceSocket)}),
  ]
};
