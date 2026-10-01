import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.accessToken();
  const targetsOurApi = req.url.startsWith(environment.apiUrl);

  const authedReq = token && targetsOurApi
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const isRefreshCall = req.url === `${environment.apiUrl}/auth/refresh`;
      const wasAuthenticated = authedReq !== req;

      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !wasAuthenticated || isRefreshCall) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((result) =>
          next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${result.access_token}`) })),
        ),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};
