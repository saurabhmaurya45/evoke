import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  apiBaseUrl: 'https://evokebackend.vercel.app',
  appUrl: 'https://theinvitely.in',
  mediaBaseUrl: 'https://pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev/asset',
  // Separate Supabase project from environment.ts (dev), co-located in us-east-1 with
  // the backend's Vercel function region to avoid cross-region latency. Publishable
  // key is safe to ship in the client bundle.
  supabaseUrl: 'https://kivrvvtlwvmtogpkrvoh.supabase.co',
  supabasePublishableKey: 'sb_publishable_bCKt-maGBHftHoI_3vbjmw_G2LfbeUz',
  // Ads measurement (see AnalyticsService): GA4 and the Meta Pixel ("theinvitely" dataset
  // in Events Manager). Both load only after the visitor accepts the cookie notice.
  ga4MeasurementId: 'G-132528WVE1',
  metaPixelId: '1157385546813768',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
