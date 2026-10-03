import { type Routes } from '@angular/router';
import { MainLayoutComponent } from './core/layouts/main-layout/main-layout.component';
import { ComingSoonComponent } from './shared/components/coming-soon/coming-soon.component';

/**
 * Root routing table. Everything renders inside the MainLayout shell.
 * Every feature is lazy-loaded (route-level code splitting); placeholder
 * routes for not-yet-built features share the ComingSoon component and are
 * scaffolded now so links and structure exist from day one.
 */
export const routes: Routes = [
  {
    // Full-screen template preview — rendered outside the marketing shell.
    path: 'preview',
    loadChildren: () => import('./features/preview/preview.routes').then((m) => m.PREVIEW_ROUTES),
  },
  {
    // Full-screen split-pane template editor — also outside the marketing shell.
    path: 'editor',
    loadChildren: () => import('./features/editor/editor.routes').then((m) => m.EDITOR_ROUTES),
  },
  {
    // Public/owner-only invitation viewer — full-screen, no marketing shell.
    path: 'i',
    loadChildren: () =>
      import('./features/invitation/invitation.routes').then((m) => m.INVITATION_ROUTES),
  },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        // The occasion hubs replaced the old Services stub (also a 301 in netlify.toml).
        path: 'services',
        pathMatch: 'full',
        redirectTo: 'wedding-invitations',
      },
      {
        path: 'wedding-invitations',
        loadComponent: () =>
          import('./features/landing/pages/landing-page/landing-page.component').then(
            (m) => m.LandingPageComponent,
          ),
        data: { page: 'wedding-invitations' },
      },
      {
        path: 'wedding-invitations/:community',
        loadComponent: () =>
          import('./features/landing/pages/landing-page/landing-page.component').then(
            (m) => m.LandingPageComponent,
          ),
      },
      {
        path: 'engagement-invitations',
        loadComponent: () =>
          import('./features/landing/pages/landing-page/landing-page.component').then(
            (m) => m.LandingPageComponent,
          ),
        data: { page: 'engagement-invitations' },
      },
      {
        path: 'blog',
        loadChildren: () => import('./features/blog/blog.routes').then((m) => m.BLOG_ROUTES),
      },
      {
        path: 'templates',
        loadChildren: () =>
          import('./features/templates/templates.routes').then((m) => m.TEMPLATES_ROUTES),
      },
      {
        path: 'pricing',
        component: ComingSoonComponent,
        title: 'Pricing • theinvitely.in',
        data: {
          eyebrow: 'Pricing',
          heading: 'Pricing',
          description: 'Detailed plan comparison is on its way.',
        },
      },
      {
        path: 'about',
        component: ComingSoonComponent,
        title: 'About • theinvitely.in',
        data: {
          eyebrow: 'Company',
          heading: 'About theinvitely.in',
          description: 'Our story is coming soon.',
        },
      },
      {
        path: 'contact',
        component: ComingSoonComponent,
        title: 'Contact • theinvitely.in',
        data: {
          eyebrow: 'Company',
          heading: 'Contact us',
          description: 'A dedicated contact experience is on its way.',
        },
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/legal/pages/legal-page/legal-page.component').then(
            (m) => m.LegalPageComponent,
          ),
        title: 'Privacy Policy • theinvitely.in',
        data: { document: 'privacy' },
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./features/legal/pages/legal-page/legal-page.component').then(
            (m) => m.LegalPageComponent,
          ),
        title: 'Terms and Conditions • theinvitely.in',
        data: { document: 'terms' },
      },
      {
        path: 'payment',
        loadChildren: () => import('./features/payment/payment.routes').then((m) => m.PAYMENT_ROUTES),
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/dashboard/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: '',
        loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/components/not-found/not-found.component').then(
            (m) => m.NotFoundComponent,
          ),
      },
    ],
  },
];
