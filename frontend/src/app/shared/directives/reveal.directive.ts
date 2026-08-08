import { DestroyRef, Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { WINDOW } from '../../core/tokens/window.token';

/**
 * Scroll-entrance animation. When the host enters the viewport it fades and
 * rises into place (transform/opacity only, GPU-friendly). With
 * `revealStagger`, direct children animate in sequence for a cascading grid.
 *
 * Safe by design:
 * - The hidden initial state is applied from JS, so with JS disabled or no
 *   IntersectionObserver the content is fully visible (no FOUC / hidden text).
 * - Disabled entirely under `prefers-reduced-motion`.
 *
 * Usage: `<div appReveal>`, `<div appReveal revealStagger>`, `[revealDelay]="120"`.
 */
@Directive({
  selector: '[appReveal]',
})
export class RevealDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  /** Stagger direct children instead of animating the host as one block. */
  readonly revealStagger = input(false, { transform: booleanAttribute });
  /** Base delay (ms) before the animation starts. */
  readonly revealDelay = input(0);
  /** Per-child stagger step (ms) when `revealStagger` is on. */
  readonly revealStep = input(90);

  private observer?: IntersectionObserver;
  private cleanupTimer = 0;

  constructor() {
    queueMicrotask(() => this.setup());
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.window?.clearTimeout(this.cleanupTimer);
    });
  }

  private get reducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private targets(): HTMLElement[] {
    return this.revealStagger() ? (Array.from(this.el.children) as HTMLElement[]) : [this.el];
  }

  private setup(): void {
    if (!this.window || this.reducedMotion) {
      return;
    }

    // Apply hidden state from JS so no-JS keeps content visible.
    for (const target of this.targets()) {
      target.classList.add('reveal-init');
    }

    if (!('IntersectionObserver' in this.window)) {
      this.play();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.play();
            this.observer?.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    this.observer.observe(this.el);
  }

  private play(): void {
    const base = this.revealDelay();
    const step = this.revealStep();
    const targets = this.targets();
    targets.forEach((target, i) => {
      target.style.transitionDelay = `${base + i * step}ms`;
      target.classList.add('reveal-in');
    });

    // Once the cascade finishes, strip the transient state so the lingering
    // transition-delay / will-change can't affect later hover transitions.
    const total = base + (targets.length - 1) * step + 900;
    this.cleanupTimer =
      this.window?.setTimeout(() => {
        for (const target of targets) {
          target.classList.remove('reveal-init', 'reveal-in');
          target.style.transitionDelay = '';
          target.style.willChange = '';
        }
      }, total) ?? 0;
  }
}
