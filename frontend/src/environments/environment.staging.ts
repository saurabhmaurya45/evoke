import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'staging',
  apiBaseUrl: 'https://staging-api.evoke.app',
  appUrl: 'https://staging.evoke.app',
  mediaBaseUrl: 'https://pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev/asset',
  // Publishable key is safe to ship in the client bundle, but staging should point at
  // a staging Supabase project, not the dev one in environment.ts.
  supabaseUrl: 'https://CHANGE_ME.supabase.co',
  supabasePublishableKey: 'CHANGE_ME',
  // Analytics only ever runs in production.
  ga4MeasurementId: null,
  metaPixelId: null,
  features: {
    analytics: true,
    themeToggle: true,
  },
};
