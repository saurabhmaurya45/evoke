import { type Routes } from '@angular/router';

export const INVITATION_ROUTES: Routes = [
  {
    path: ':slug',
    loadComponent: () =>
      import('./pages/invitation-page/invitation-page.component').then(
        (m) => m.InvitationPageComponent,
      ),
    title: 'Your Invitation • theinvitely.in',
  },
];
