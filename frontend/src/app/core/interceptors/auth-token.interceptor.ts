import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Attaches the bearer token to outgoing requests when authenticated — but only to our
 * own backend, so the Supabase access token is never sent to a third-party origin.
 * Skips requests that already carry an Authorization header (AuthService sets one
 * explicitly while establishing a session, before the signal reflects the new token).
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token || req.headers.has('Authorization') || !req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
