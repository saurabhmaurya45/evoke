import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  apiBaseUrl: 'https://api.evoke.app',
  appUrl: 'https://evoke.app',
  // Publishable key is safe to ship in the client bundle, but production values should
  // come from the production Supabase project, not the dev one in environment.ts.
  supabaseUrl: 'https://CHANGE_ME.supabase.co',
  supabasePublishableKey: 'CHANGE_ME',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
