import { Injectable, inject } from '@angular/core';
import { type PreloadingStrategy, type Route } from '@angular/router';
import { EMPTY, type Observable, mergeMap, timer } from 'rxjs';
import { WINDOW } from '../tokens/window.token';

/** Long enough for the landing page's own requests (LCP image, fonts) to finish first. */
const PRELOAD_AFTER_MS = 3000;

/**
 * Preloads lazy routes marked `data: { preload: true }` a few seconds after the
 * app starts, so tapping "Preview" / "Use" / "Edit" doesn't wait on downloading
 * that feature's code. Browser only: a pending timer would hold up prerendering.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  private readonly window = inject(WINDOW);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this.window || !route.data?.['preload']) return EMPTY;
    return timer(PRELOAD_AFTER_MS).pipe(mergeMap(() => load()));
  }
}
