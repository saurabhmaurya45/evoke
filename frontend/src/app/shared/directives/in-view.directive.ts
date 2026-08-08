import {
  DestroyRef,
  Directive,
  ElementRef,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { WINDOW } from '../../core/tokens/window.token';

/**
 * Emits once (or every time) the host scrolls into view, using a single
 * IntersectionObserver — far cheaper than scroll math. Drives reveal
 * animations and lazy counters without any polling.
 *
 * Usage: `<section appInView (enter)="onEnter()" [threshold]="0.3">`
 */
@Directive({
  selector: '[appInView]',
})
export class InViewDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  /** Fraction of the element that must be visible to fire. */
  readonly threshold = input(0.2);
  /** Stop observing after the first intersection. */
  readonly once = input(true, { transform: booleanAttribute });

  readonly enter = output<void>();

  private observer?: IntersectionObserver;

  constructor() {
    // Defer until inputs are set.
    queueMicrotask(() => this.observe());
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private observe(): void {
    if (!this.window || !('IntersectionObserver' in this.window)) {
      this.enter.emit();
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.enter.emit();
            if (this.once()) {
              this.observer?.disconnect();
            }
          }
        }
      },
      { threshold: this.threshold() },
    );
    this.observer.observe(this.el);
  }
}
