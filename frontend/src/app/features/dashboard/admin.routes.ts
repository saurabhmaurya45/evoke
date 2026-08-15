import { type Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

/** Platform admin area. Role-gated by adminGuard. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    canActivate: [adminGuard],
    title: 'Admin • Evoke',
  },
];
