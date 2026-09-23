import { type Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/** Checkout (`/payment?site=<eventId>`) and the post-Razorpay landing page. */
export const PAYMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/checkout-page/checkout-page.component').then((m) => m.CheckoutPageComponent),
    canActivate: [authGuard],
    title: 'Checkout • theinvitely.in',
  },
  {
    path: 'result',
    loadComponent: () =>
      import('./pages/payment-result-page/payment-result-page.component').then(
        (m) => m.PaymentResultPageComponent,
      ),
    canActivate: [authGuard],
    title: 'Payment status • theinvitely.in',
  },
];
