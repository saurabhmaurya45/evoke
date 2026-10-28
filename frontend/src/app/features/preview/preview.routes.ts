import { type Routes } from '@angular/router';

/**
 * Template preview feature. Rendered full-screen (outside the marketing
 * shell) so the invitation template fills the viewport. Lazy-loaded.
 */
export const PREVIEW_ROUTES: Routes = [
  {
    path: ':templateId',
    loadComponent: () =>
      import('./pages/preview-page/preview-page.component').then((m) => m.PreviewPageComponent),
    title: 'Template Preview • theinvitely.in',
    // The page chunk is separate from this routes file; flag it too so
    // IdlePreloadingStrategy fetches it along with the parent.
    data: { preload: true },
  },
  { path: '', pathMatch: 'full', redirectTo: 'tpl-samarpan-royal' },
];
