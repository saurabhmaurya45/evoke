import { type Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/** Authenticated customer dashboard. Guarded by the functional authGuard. */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/user-dashboard/user-dashboard.component').then((m) => m.UserDashboardComponent),
    canActivate: [authGuard],
    title: 'Dashboard • Evoke',
  },
];
