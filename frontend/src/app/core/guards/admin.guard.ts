import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Role guard for the admin area. Unauthenticated visitors go to /login with
 * the intended destination preserved; signed-in non-admins are sent to their
 * own dashboard rather than the login screen (they are authenticated — they
 * simply lack the role).
 */
export const adminGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/dashboard']);
};
