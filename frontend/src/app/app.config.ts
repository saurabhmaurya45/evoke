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
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/interceptors/api-base-url.interceptor';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AnalyticsService } from './core/services/analytics.service';
import { AuthService } from './core/services/auth.service';
import { HttpTemplateRepository } from './features/editor/data/http-template-repository';
import { TEMPLATE_REPOSITORY } from './features/editor/data/template-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Reuse the prerendered DOM instead of wiping and re-rendering it on boot —
    // without this the page flashed blank and replayed its entrance animations.
    // Event replay keeps clicks made before boot finishes from being lost.
    provideClientHydration(withEventReplay()),
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
    // Page-view tracking for ads; loads nothing until the visitor consents.
    provideAppInitializer(() => inject(AnalyticsService).init()),
    // Swap the editor's draft persistence from localStorage to the backend API.
    { provide: TEMPLATE_REPOSITORY, useClass: HttpTemplateRepository },
  ],
};
