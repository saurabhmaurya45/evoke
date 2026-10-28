import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { WINDOW } from '../../../core/tokens/window.token';

/** Navigations faster than this never show the bar, so instant ones don't flicker. */
const SHOW_DELAY_MS = 120;

/**
 * Thin top progress bar while a route navigation is pending — mostly the
 * download of a lazy feature chunk (preview, editor, dashboard). Without it a
 * tap on "Preview"/"Use"/"Edit" looked like nothing happened for a second or
 * more on a slow phone. Lives in the app root, so it also covers the
 * full-screen routes that sit outside the main shell.
 */
@Component({
  selector: 'app-nav-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <div class="nav-progress" role="progressbar" aria-label="Loading page">
        <span class="nav-progress__bar"></span>
      </div>
    }
  `,
  styles: `
    .nav-progress {
      position: fixed;
      inset: 0 0 auto;
      height: 3px;
      z-index: 10000;
      overflow: hidden;
      pointer-events: none;
      background: rgba(201, 162, 39, 0.18);
    }

    .nav-progress__bar {
      position: absolute;
      inset: 0 auto 0 0;
      width: 40%;
      background: linear-gradient(90deg, #8b5e34, #c9a227, #e8c88a);
      box-shadow: 0 0 8px rgba(201, 162, 39, 0.6);
      animation: nav-progress-slide 1.1s ease-in-out infinite;
    }

    @keyframes nav-progress-slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-progress__bar {
        width: 100%;
        animation: none;
        opacity: 0.8;
      }
    }
  `,
})
export class NavProgressComponent {
  protected readonly active = signal(false);

  constructor() {
    const window = inject(WINDOW);
    if (!window) return; // nothing to show while prerendering

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
      this.active.set(false);
    };
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(timer);
        timer = setTimeout(() => this.active.set(true), SHOW_DELAY_MS);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        stop();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      stop();
      subscription.unsubscribe();
    });
  }
}
