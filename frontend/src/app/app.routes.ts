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
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: 'services',
        component: ComingSoonComponent,
        title: 'Services • Evoke',
        data: {
          eyebrow: 'Services',
          heading: 'Services',
          description:
            'Explore every occasion Evoke supports — a dedicated services hub is on the way.',
        },
      },
      {
        path: 'templates',
        component: ComingSoonComponent,
        title: 'Templates • Evoke',
        data: {
          eyebrow: 'Templates',
          heading: 'Template Gallery',
          description: 'A full, filterable template gallery is coming soon.',
        },
      },
      {
        path: 'pricing',
        component: ComingSoonComponent,
        title: 'Pricing • Evoke',
        data: {
          eyebrow: 'Pricing',
          heading: 'Pricing',
          description: 'Detailed plan comparison is on its way.',
        },
      },
      {
        path: 'about',
        component: ComingSoonComponent,
        title: 'About • Evoke',
        data: {
          eyebrow: 'Company',
          heading: 'About Evoke',
          description: 'Our story is coming soon.',
        },
      },
      {
        path: 'contact',
        component: ComingSoonComponent,
        title: 'Contact • Evoke',
        data: {
          eyebrow: 'Company',
          heading: 'Contact us',
          description: 'A dedicated contact experience is on its way.',
        },
      },
      {
        path: 'payment',
        component: ComingSoonComponent,
        title: 'Checkout • Evoke',
        data: {
          eyebrow: 'Checkout',
          heading: 'Secure Checkout',
          description: 'One-time secure checkout is coming soon.',
        },
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
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
