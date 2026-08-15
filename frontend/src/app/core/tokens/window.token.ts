import { InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * SSR-safe `window` provider — null anywhere but a real browser.
 *
 * On the server `DOCUMENT.defaultView` is a stub that answers to some
 * properties but not others (no `matchMedia`, no `requestAnimationFrame`), so
 * resolving through it would hand callers an object that passes a truthiness
 * check and then throws. Gating on the platform keeps every `if (!win)` and
 * `this.window?.` guard in the codebase honest.
 */
export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => (isPlatformBrowser(inject(PLATFORM_ID)) ? inject(DOCUMENT).defaultView : null),
});
