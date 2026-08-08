import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { auditTime, map, startWith } from 'rxjs/operators';
import { WINDOW } from '../tokens/window.token';
import { BREAKPOINT_NAV } from '../constants/app.constants';

/**
 * Central, signal-based source of viewport state (scroll + width).
 * A single set of passive listeners feeds every consumer, so we never
 * attach duplicate scroll/resize handlers across components.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _scrollY = signal(0);
  private readonly _width = signal(this.window?.innerWidth ?? 1440);

  /** Current vertical scroll offset in px. */
  readonly scrollY = this._scrollY.asReadonly();

  /** Current viewport width in px. */
  readonly width = this._width.asReadonly();

  /** True once the page has scrolled past the nav threshold. */
  readonly scrolled = computed(() => this._scrollY() > 20);

  /** True below the desktop-navigation breakpoint. */
  readonly isMobile = computed(() => this._width() < BREAKPOINT_NAV);

  constructor() {
    const win = this.window;
    if (!win) {
      return;
    }

    const scroll$ = fromEvent(win, 'scroll', { passive: true }).pipe(
      auditTime(16),
      map(() => win.scrollY),
      startWith(win.scrollY),
    );

    const resize$ = fromEvent(win, 'resize', { passive: true }).pipe(
      auditTime(120),
      map(() => win.innerWidth),
      startWith(win.innerWidth),
    );

    scroll$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((y) => this._scrollY.set(y));

    merge(resize$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((w) => this._width.set(w));
  }
}
