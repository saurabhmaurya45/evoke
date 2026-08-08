import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  inject,
  viewChildren,
} from '@angular/core';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { MagneticDirective } from '../../../../shared/directives/magnetic.directive';
import { ViewportService } from '../../../../core/services/viewport.service';
import { WINDOW } from '../../../../core/tokens/window.token';
import { HomeContentService } from '../../data/home-content.service';

/**
 * Hero: scroll-driven parallax blobs and cursor-driven floating preview cards
 * over the app-wide Three.js backdrop (provided globally by the shell).
 * Parallax reads the shared scroll signal (no local listener).
 */
@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageSlotComponent, MagneticDirective],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  private readonly viewport = inject(ViewportService);
  private readonly window = inject(WINDOW);
  protected readonly content = inject(HomeContentService);

  private readonly floatCards = viewChildren<ElementRef<HTMLElement>>('floatCard');

  protected readonly parallax1 = computed(() => this.viewport.scrollY() * 0.1);
  protected readonly parallax2 = computed(() => this.viewport.scrollY() * 0.06);
  protected readonly parallax3 = computed(() => this.viewport.scrollY() * 0.14);

  private get reducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  protected onPointerMove(event: MouseEvent, host: HTMLElement): void {
    if (this.reducedMotion) {
      return;
    }
    const rect = host.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    this.floatCards().forEach((ref, i) => {
      const factor = (i + 1) * 10;
      ref.nativeElement.style.transform = `translate(${x * -factor}px, ${y * -factor}px)`;
    });
  }
}
