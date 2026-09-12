import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/interceptors/api-base-url.interceptor';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';
import { HttpTemplateRepository } from './features/editor/data/http-template-repository';
import { TEMPLATE_REPOSITORY } from './features/editor/data/template-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Route `data` → component signal inputs (ComingSoon page).
      withComponentInputBinding(),
      // Restore scroll on back/forward and honour in-page #fragment anchors.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiBaseUrlInterceptor, authTokenInterceptor, errorInterceptor]),
    ),
    // Restores/validates the Supabase session (and OAuth/email-link callback tokens in
    // the URL) before the router activates the first route, so auth guards never see a
    // stale "logged out" state on a hard refresh.
    provideAppInitializer(() => inject(AuthService).init()),
    // Swap the editor's draft persistence from localStorage to the backend API.
    { provide: TEMPLATE_REPOSITORY, useClass: HttpTemplateRepository },
  ],
};
