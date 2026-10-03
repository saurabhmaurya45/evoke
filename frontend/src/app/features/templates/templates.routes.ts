import { type Routes } from '@angular/router';

/** Public template gallery. */
export const TEMPLATES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/template-gallery/template-gallery.component').then(
        (m) => m.TemplateGalleryComponent,
      ),
    title: 'Templates • theinvitely.in',
  },
  {
    // One indexable page per template; title/meta are set by the component.
    path: ':slug',
    loadComponent: () =>
      import('./pages/template-detail/template-detail.component').then(
        (m) => m.TemplateDetailComponent,
      ),
  },
];
