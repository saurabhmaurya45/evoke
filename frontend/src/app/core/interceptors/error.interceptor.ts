import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Normalises HTTP failures into a single place. Real UX (toasts, retries)
 * will hook in here as the app grows; for now it logs in non-prod builds.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!environment.production) {
        console.error(`[HTTP ${error.status}] ${req.method} ${req.url}`, error.message);
      }
      return throwError(() => error);
    }),
  );
};
