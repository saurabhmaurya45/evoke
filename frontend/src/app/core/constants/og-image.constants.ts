import { environment } from '../../../environments/environment';

/**
 * Default share card (1200×630) for pages without their own image. Also the
 * static fallback in index.html, which is all WhatsApp/Facebook previews see
 * on client-rendered routes.
 */
export const DEFAULT_OG_IMAGE = {
  url: `${environment.appUrl}/og/og-default.jpg`,
  width: 1200,
  height: 630,
  alt: 'Wedding invitation website on a phone — create yours at theinvitely.in',
} as const;

// Kept out of seo.constants.ts: SeoService is in the initial bundle, and the
// keyword lists should only load with the pages that use them.
