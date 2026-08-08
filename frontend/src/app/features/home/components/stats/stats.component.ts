import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { InViewDirective } from '../../../../shared/directives/in-view.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { WINDOW } from '../../../../core/tokens/window.token';
import { HomeContentService } from '../../data/home-content.service';

/**
 * Animated statistics band. Counters run once the band scrolls into view
 * (IntersectionObserver via InViewDirective) using a single rAF loop with
 * cubic ease-out — cancelled on destroy.
 */
@Component({
  selector: 'app-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InViewDirective, RevealDirective, SectionAuraComponent],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent {
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly content = inject(HomeContentService);

  private static readonly DURATION = 1600;
  private readonly progress = signal(0);
  private started = false;
  private rafId = 0;

  /** Display strings for each stat, derived from eased progress. */
  protected readonly values = computed(() =>
    this.content.stats.map((stat) => {
      if (stat.target === null) {
        return stat.staticValue ?? '';
      }
      const current = Math.round(stat.target * this.progress());
      return `${current}${stat.suffix ?? ''}`;
    }),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.window?.cancelAnimationFrame(this.rafId));
  }

  protected start(): void {
    if (this.started || !this.window) {
      this.progress.set(1);
      return;
    }
    this.started = true;
    const startTime = this.window.performance.now();
    const tick = (now: number): void => {
      const p = Math.min((now - startTime) / StatsComponent.DURATION, 1);
      this.progress.set(1 - Math.pow(1 - p, 3));
      if (p < 1) {
        this.rafId = this.window!.requestAnimationFrame(tick);
      }
    };
    this.rafId = this.window.requestAnimationFrame(tick);
  }
}
