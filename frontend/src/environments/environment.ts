import type { AppEnvironment } from './environment.model';

// Default (development) environment. Swapped at build time via
// angular.json `fileReplacements` for staging/production.
export const environment: AppEnvironment = {
  production: false,
  name: 'development',
  apiBaseUrl: 'http://localhost:8000',
  appUrl: 'http://localhost:4200',
  supabaseUrl: 'https://jcyogzcqifqukleqtbtw.supabase.co',
  supabasePublishableKey: 'sb_publishable_XBcDrgEjVQfygZ4bnUOoxQ_YoFX7wlp',
  features: {
    analytics: false,
    themeToggle: true,
  },
};
