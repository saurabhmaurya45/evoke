import { type Routes } from '@angular/router';

/** Home feature routes (lazy-loaded from the root router). */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-page/home-page.component').then((m) => m.HomePageComponent),
    title: 'Evoke — Create Beautiful Invitation Websites in Minutes',
  },
];
