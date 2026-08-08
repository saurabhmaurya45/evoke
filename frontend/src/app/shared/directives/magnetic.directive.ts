import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { WINDOW } from '../../core/tokens/window.token';

/**
 * Magnetic pull for CTA buttons/links — the element eases toward the cursor
 * and springs back on leave. Transform-only, reduced-motion aware.
 *
 * Usage: `<a appMagnetic>…</a>`
 */
@Directive({
  selector: '[appMagnetic]',
})
export class MagneticDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(WINDOW);
  private static readonly STRENGTH = 0.25;

  private get reducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  @HostListener('mousemove', ['$event'])
  onMove(event: MouseEvent): void {
    if (this.reducedMotion) {
      return;
    }
    const rect = this.el.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    this.el.style.transition = 'transform 0.1s linear';
    this.el.style.transform = `translate(${x * MagneticDirective.STRENGTH}px, ${y * MagneticDirective.STRENGTH}px)`;
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.el.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
    this.el.style.transform = 'translate(0, 0)';
  }
}
