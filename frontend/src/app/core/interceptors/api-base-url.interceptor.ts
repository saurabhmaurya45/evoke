import { type HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Prefixes relative API paths (starting with `api/` or `/api/`) with the
 * environment base URL, so feature services can use short, env-agnostic paths.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const isRelativeApi = /^\/?api\//.test(req.url);
  if (!isRelativeApi) {
    return next(req);
  }
  const path = req.url.replace(/^\/?api\//, '');
  return next(req.clone({ url: `${environment.apiBaseUrl}/${path}` }));
};
