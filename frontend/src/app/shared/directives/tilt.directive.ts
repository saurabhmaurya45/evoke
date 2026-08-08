import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { WINDOW } from '../../core/tokens/window.token';

/**
 * 3D pointer-tilt for cards. Pure transform work (GPU-composited), no
 * change detection, and fully disabled under `prefers-reduced-motion`.
 *
 * Usage: `<div appTilt>…</div>`
 */
@Directive({
  selector: '[appTilt]',
})
export class TiltDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(WINDOW);

  private get reducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  @HostListener('mousemove', ['$event'])
  onMove(event: MouseEvent): void {
    if (this.reducedMotion) {
      return;
    }
    const rect = this.el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -6;
    const rotateY = ((x - cx) / cx) * 6;
    this.el.style.transition = 'transform 0.05s linear';
    this.el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.02)`;
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.el.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
    this.el.style.transform =
      'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';
  }
}
