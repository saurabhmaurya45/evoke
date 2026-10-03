import { RenderMode, type ServerRoute } from '@angular/ssr';
import { TEMPLATE_SEO } from './features/templates/data/template-seo.data';
import { LANDING_PAGES } from './features/landing/data/landing-pages.data';
import { BLOG_POSTS } from './features/blog/data/blog-posts.data';

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
  {
    path: 'templates/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => Promise.resolve(TEMPLATE_SEO.map(({ slug }) => ({ slug }))),
  },
  { path: 'wedding-invitations', renderMode: RenderMode.Prerender },
  {
    path: 'wedding-invitations/:community',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () =>
      Promise.resolve(
        LANDING_PAGES.filter((page) => page.parent === 'wedding-invitations').map((page) => ({
          community: page.path.split('/')[1],
        })),
      ),
  },
  { path: 'engagement-invitations', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Prerender },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => Promise.resolve(BLOG_POSTS.map(({ slug }) => ({ slug }))),
  },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },

  // Auth screens: real pages, but nothing to index.
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'signup', renderMode: RenderMode.Prerender },

  // Session-dependent or runtime-driven — client-only.
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'payment', renderMode: RenderMode.Client },
  { path: 'payment/**', renderMode: RenderMode.Client },
  { path: 'preview/**', renderMode: RenderMode.Client },
  { path: 'editor/**', renderMode: RenderMode.Client },
  // Invitation viewer is iframe + postMessage and resolves templates by relative URL —
  // it can't render on the server (SSR produced the error state, flashed before hydration).
  { path: 'i/**', renderMode: RenderMode.Client },
  { path: 'verify-otp', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'check-email', renderMode: RenderMode.Client },
  { path: 'email-verified', renderMode: RenderMode.Client },
  { path: 'auth/callback/**', renderMode: RenderMode.Client },

  // Everything else (including 404) renders on the server on demand.
  { path: '**', renderMode: RenderMode.Server },
];
