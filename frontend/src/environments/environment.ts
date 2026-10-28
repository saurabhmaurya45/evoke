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
  mediaBaseUrl: 'https://pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev/asset',
  supabaseUrl: 'https://jcyogzcqifqukleqtbtw.supabase.co',
  supabasePublishableKey: 'sb_publishable_XBcDrgEjVQfygZ4bnUOoxQ_YoFX7wlp',
  // Analytics only ever runs in production.
  ga4MeasurementId: null,
  metaPixelId: null,
  features: {
    analytics: false,
    themeToggle: true,
  },
};
