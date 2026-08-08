import { InjectionToken, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * SSR-safe `window` provider. Depends on DOCUMENT.defaultView so that
 * server rendering (future) resolves to `null` instead of throwing.
 */
export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).defaultView,
});
