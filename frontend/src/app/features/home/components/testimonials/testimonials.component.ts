import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { WINDOW } from '../../../../core/tokens/window.token';
import { HomeContentService } from '../../data/home-content.service';

/**
 * Auto-advancing testimonial carousel. Rotation is a single interval that
 * respects a `paused` signal (hover/focus); the active slide and star row
 * are computed. Interval is cleared on destroy.
 */
@Component({
  selector: 'app-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SectionAuraComponent, RevealDirective],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent {
  private readonly window = inject(WINDOW);
  protected readonly content = inject(HomeContentService);

  private static readonly INTERVAL_MS = 5000;
  protected readonly index = signal(0);
  private readonly paused = signal(false);

  protected readonly active = computed(() => this.content.testimonials[this.index()]);
  protected readonly stars = '★★★★★';

  constructor() {
    const id = this.window?.setInterval(() => {
      if (!this.paused()) {
        this.index.update((i) => (i + 1) % this.content.testimonials.length);
      }
    }, TestimonialsComponent.INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => {
      if (id !== undefined) {
        this.window?.clearInterval(id);
      }
    });
  }

  protected select(i: number): void {
    this.index.set(i);
  }

  protected pause(): void {
    this.paused.set(true);
  }

  protected resume(): void {
    this.paused.set(false);
  }
}
