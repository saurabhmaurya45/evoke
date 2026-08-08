import { type Routes } from '@angular/router';
import { ComingSoonComponent } from '../../shared/components/coming-soon/coming-soon.component';
import { authGuard } from '../../core/guards/auth.guard';

/** Authenticated dashboard area. Guarded by the functional authGuard. */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: ComingSoonComponent,
    canActivate: [authGuard],
    title: 'Dashboard • Evoke',
    data: {
      eyebrow: 'Dashboard',
      heading: 'Your dashboard',
      description: 'Manage your invitation websites, guests, and RSVPs — coming soon.',
    },
  },
];
