import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideAppInitializer } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideApi } from './core/modules/openapi';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { initAuth } from './core/auth-initializer';
import { AuthRefreshScheduler } from './core/auth-refresh-scheduler';
import { environment } from '../environments/environment';
import { ChatSocket } from './core/chat-socket';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideApi({
      basePath: environment.apiUrl,
      withCredentials: true,
    }),
    provideAppInitializer(initAuth),
    provideAppInitializer(() => { inject(AuthRefreshScheduler); }),
    provideAppInitializer(() => { inject(ChatSocket)}),
  ]
};
