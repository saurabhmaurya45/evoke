import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { ViewportService } from '../../core/services/viewport.service';
import { WINDOW } from '../../core/tokens/window.token';

/**
 * Scroll parallax. Translates the host relative to its position in the
 * viewport, so decorative layers drift as the user scrolls. Driven by the
 * shared `ViewportService.scrollY` signal (no extra scroll listener),
 * transform-only, and disabled under `prefers-reduced-motion`.
 *
 * Usage: `<span appParallax [parallaxSpeed]="0.25">`
 */
@Directive({
  selector: '[appParallax]',
})
export class ParallaxDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly viewport = inject(ViewportService);
  private readonly window = inject(WINDOW);

  /** Drift factor: higher = more movement. Negative inverts direction. */
  readonly parallaxSpeed = input(0.2);
  readonly parallaxAxis = input<'x' | 'y'>('y');

  constructor() {
    const win = this.window;
    if (!win || win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // Re-evaluate whenever scroll offset or viewport width changes.
    effect(() => {
      this.viewport.scrollY();
      this.viewport.width();
      this.update(win.innerHeight);
    });
  }

  private update(viewportHeight: number): void {
    const rect = this.el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    // -1 (below fold) .. 0 (centered) .. 1 (above fold)
    const progress = (center - viewportHeight / 2) / viewportHeight;
    const distance = progress * this.parallaxSpeed() * 100;
    this.el.style.transform =
      this.parallaxAxis() === 'y'
        ? `translate3d(0, ${distance.toFixed(2)}px, 0)`
        : `translate3d(${distance.toFixed(2)}px, 0, 0)`;
  }
}
