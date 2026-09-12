import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'staging',
  apiBaseUrl: 'https://staging-api.evoke.app',
  appUrl: 'https://staging.evoke.app',
  // Publishable key is safe to ship in the client bundle, but staging should point at
  // a staging Supabase project, not the dev one in environment.ts.
  supabaseUrl: 'https://CHANGE_ME.supabase.co',
  supabasePublishableKey: 'CHANGE_ME',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
