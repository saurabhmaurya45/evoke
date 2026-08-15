import { type Routes } from '@angular/router';

/** Public template gallery. */
export const TEMPLATES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/template-gallery/template-gallery.component').then(
        (m) => m.TemplateGalleryComponent,
      ),
    title: 'Templates • Evoke',
  },
];
