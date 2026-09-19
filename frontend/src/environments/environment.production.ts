import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  apiBaseUrl: 'https://evokebackend.vercel.app',
  appUrl: 'https://evokefrontend.vercel.app',
  // Separate Supabase project from environment.ts (dev), co-located in us-east-1 with
  // the backend's Vercel function region to avoid cross-region latency. Publishable
  // key is safe to ship in the client bundle.
  supabaseUrl: 'https://kivrvvtlwvmtogpkrvoh.supabase.co',
  supabasePublishableKey: 'sb_publishable_bCKt-maGBHftHoI_3vbjmw_G2LfbeUz',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
