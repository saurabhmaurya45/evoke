import { type HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Prefixes relative request paths (e.g. `v1/events`) with the environment API base
 * URL, so feature services can use short, env-agnostic paths. Absolute URLs (already
 * starting with a scheme — including calls to Supabase or any other third party) pass
 * through untouched.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const isAbsolute = /^https?:\/\//i.test(req.url);
  if (isAbsolute) {
    return next(req);
  }
  const path = req.url.replace(/^\/+/, '');
  return next(req.clone({ url: `${environment.apiBaseUrl}/${path}` }));
};
