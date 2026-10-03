import { type Routes } from '@angular/router';

/** Wording, etiquette and how-to articles. Prerendered (see app.routes.server.ts). */
export const BLOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/blog-index/blog-index.component').then((m) => m.BlogIndexComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./pages/blog-post/blog-post.component').then((m) => m.BlogPostComponent),
  },
];
