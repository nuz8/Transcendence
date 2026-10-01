import { inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { Auth } from './auth';

export function initAuth() {
  const auth = inject(Auth);
  return firstValueFrom(auth.refresh().pipe(catchError(() => of(null))));
}
