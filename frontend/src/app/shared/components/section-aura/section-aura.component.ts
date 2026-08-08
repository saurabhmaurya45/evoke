import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ParallaxDirective } from '../../directives/parallax.directive';

/**
 * Decorative, non-interactive backdrop for content sections: soft gold blobs
 * that gently animate and drift on scroll (echoing the hero). Purely
 * presentational — `aria-hidden`, `pointer-events: none`, sits behind content.
 *
 * Usage: place as the first child of a `position: relative` section.
 */
@Component({
  selector: 'app-section-aura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParallaxDirective],
  template: `
    <div class="aura" aria-hidden="true">
      <span class="aura__layer aura__layer--1" appParallax [parallaxSpeed]="0.22">
        <i class="aura__blob aura__blob--gold"></i>
      </span>
      <span class="aura__layer aura__layer--2" appParallax [parallaxSpeed]="-0.16">
        <i class="aura__blob" [class]="'aura__blob--' + tone()"></i>
      </span>
    </div>
  `,
  styleUrl: './section-aura.component.scss',
})
export class SectionAuraComponent {
  /** Secondary blob tone, to vary the palette per section. */
  readonly tone = input<'sand' | 'clay' | 'gold'>('sand');
}
