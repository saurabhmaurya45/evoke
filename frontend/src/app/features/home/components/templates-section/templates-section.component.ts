import {
  ChangeDetectionStrategy,
  Component,
  type AfterViewChecked,
  type ElementRef,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { TemplateCatalogService, formatPrice } from '../../../templates/data/template-catalog.service';

/**
 * Templates carousel. A native scroll-snap track (so touch/trackpad swiping
 * and keyboard scrolling work for free) with arrow buttons that page through
 * it. Arrow disabled state is derived from the track's scroll position.
 */
@Component({
  selector: 'app-templates-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeadingComponent,
    SectionAuraComponent,
    ImageSlotComponent,
    TiltDirective,
    RevealDirective,
    RouterLink,
  ],
  templateUrl: './templates-section.component.html',
  styleUrl: './templates-section.component.scss',
})
export class TemplatesSectionComponent implements AfterViewChecked {
  private readonly catalog = inject(TemplateCatalogService);

  /** Only published templates reach the public carousel. */
  protected readonly templates = this.catalog.published;
  protected readonly price = formatPrice;

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly cardVideos = viewChildren<ElementRef<HTMLVideoElement>>('vid');
  private readonly startedVideos = new WeakSet<HTMLVideoElement>();
  private onScrollRun = false;

  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);

  ngAfterViewChecked(): void {
    if (!this.onScrollRun) {
      this.onScrollRun = true;
      this.onScroll();
    }
    // The WeakSet only records a *successful* play() (see HeroComponent for why a
    // rejected attempt needs to stay retryable rather than being marked done).
    for (const { nativeElement } of this.cardVideos()) {
      if (this.startedVideos.has(nativeElement) || typeof nativeElement.play !== 'function') {
        continue;
      }
      nativeElement.muted = true;
      void nativeElement
        .play()
        .then(() => this.startedVideos.add(nativeElement))
        .catch(() => {});
    }
  }

  /** Page the track by one viewport width. `direction` is -1 (back) or 1 (forward). */
  protected scrollBy(direction: -1 | 1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  /** Recompute arrow availability; 2px tolerance absorbs sub-pixel scroll widths. */
  protected onScroll(): void {
    const el = this.track().nativeElement;
    this.atStart.set(el.scrollLeft <= 2);
    this.atEnd.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }
}
