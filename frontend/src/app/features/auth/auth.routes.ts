import { type Routes } from '@angular/router';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';

// Auth screens share one reusable frontend-only flow until the provider adapter is connected.

/** Authentication routes (login / signup). Lazy-loaded as one chunk. */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: AuthPageComponent,
    title: 'Log in • Evoke',
    data: { mode: 'login' },
  },
  {
    path: 'signup',
    component: AuthPageComponent,
    title: 'Sign up • Evoke',
    data: { mode: 'signup' },
  },
  { path: 'verify-otp', component: AuthPageComponent, title: 'Verify code • Evoke', data: { mode: 'otp' } },
  { path: 'forgot-password', component: AuthPageComponent, title: 'Forgot password • Evoke', data: { mode: 'forgot' } },
  { path: 'reset-password', component: AuthPageComponent, title: 'Reset password • Evoke', data: { mode: 'reset' } },
  { path: 'check-email', component: AuthPageComponent, title: 'Check your email • Evoke', data: { mode: 'check-email' } },
  { path: 'email-verified', component: AuthPageComponent, title: 'Email verified • Evoke', data: { mode: 'verified' } },
  { path: 'auth/callback/:provider', component: AuthPageComponent, title: 'Signing you in • Evoke', data: { mode: 'callback' } },
];
