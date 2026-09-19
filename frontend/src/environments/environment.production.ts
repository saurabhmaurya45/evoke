import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  apiBaseUrl: 'https://evokebackend.vercel.app',
  appUrl: 'https://evokefrontend.vercel.app',
  // Same Supabase project as environment.ts for now — there is no separate
  // production project yet. Publishable key is safe to ship in the client bundle.
  supabaseUrl: 'https://jcyogzcqifqukleqtbtw.supabase.co',
  supabasePublishableKey: 'sb_publishable_XBcDrgEjVQfygZ4bnUOoxQ_YoFX7wlp',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
