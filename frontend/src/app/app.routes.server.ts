import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Per-route render strategy.
 *
 * Public marketing pages are prerendered at build time — they are the pages
 * search engines index, and static HTML is both the fastest and the cheapest
 * to serve. Authenticated and per-template routes render on the client:
 * their content depends on a session or on runtime state, so prerendering
 * them would either leak nothing useful or produce a shell that must be
 * replaced on hydration anyway.
 */
export const serverRoutes: ServerRoute[] = [
  // Marketing pages — crawled, so prerender to static HTML.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'templates', renderMode: RenderMode.Prerender },
  { path: 'services', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

  // Auth screens: real pages, but nothing to index.
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'signup', renderMode: RenderMode.Prerender },

  // Session-dependent or runtime-driven — client-only.
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'payment', renderMode: RenderMode.Client },
  { path: 'preview/**', renderMode: RenderMode.Client },
  { path: 'editor/**', renderMode: RenderMode.Client },
  { path: 'verify-otp', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'check-email', renderMode: RenderMode.Client },
  { path: 'email-verified', renderMode: RenderMode.Client },
  { path: 'auth/callback/**', renderMode: RenderMode.Client },

  // Everything else (including 404) renders on the server on demand.
  { path: '**', renderMode: RenderMode.Server },
];
