import type { AppEnvironment } from './environment.model';

// Default (development) environment. Swapped at build time via
// angular.json `fileReplacements` for staging/production.
export const environment: AppEnvironment = {
  production: false,
  name: 'development',
  // Same origin as `ng serve`: proxy.conf.json forwards /v1 to
  // https://evokebackend.vercel.app. Calling the backend directly from
  // localhost is blocked by its CORS policy (it only allows the real site).
  apiBaseUrl: 'http://localhost:4200',
  appUrl: 'http://localhost:4200',
  supabaseUrl: 'https://jcyogzcqifqukleqtbtw.supabase.co',
  supabasePublishableKey: 'sb_publishable_XBcDrgEjVQfygZ4bnUOoxQ_YoFX7wlp',
  features: {
    analytics: false,
    themeToggle: true,
  },
};
