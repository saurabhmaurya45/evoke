import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { WINDOW } from '../../../../core/tokens/window.token';
import {
  TemplateCatalogService,
  formatPrice,
  type CatalogTemplate,
} from '../../../templates/data/template-catalog.service';
import { templateSeoBySlotId } from '../../../templates/data/template-seo.data';

/**
 * Templates carousel. A native scroll-snap track (touch/trackpad swiping and
 * keyboard scrolling for free) with arrow buttons that page through it on
 * desktop. Each card is a phone-shaped preview of the template's real opening.
 *
 * Ten looping videos would be wasteful, so only cards at least half on screen
 * play; the rest show their poster.
 */
@Component({
  selector: 'app-templates-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SectionAuraComponent, RevealDirective, RouterLink],
  templateUrl: './templates-section.component.html',
  styleUrl: './templates-section.component.scss',
})
export class TemplatesSectionComponent implements AfterViewChecked {
  private readonly catalog = inject(TemplateCatalogService);
  private readonly window = inject(WINDOW);

  /** Only published templates reach the public carousel. */
  protected readonly templates = this.catalog.published;
  protected readonly price = formatPrice;
  /** Prices render only once they come from the backend — never the ₹0 seed. */
  protected readonly pricesKnown = this.catalog.pricesKnown;

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly cardVideos = viewChildren<ElementRef<HTMLVideoElement>>('vid');
  private readonly observed = new WeakSet<HTMLVideoElement>();
  private observer: IntersectionObserver | null = null;
  private onScrollRun = false;

  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  ngAfterViewChecked(): void {
    if (!this.onScrollRun) {
      this.onScrollRun = true;
      this.onScroll();
    }
    this.observeVideos();
  }

  /** URL slug of the template's own page. */
  protected slug(template: CatalogTemplate): string {
    return templateSeoBySlotId(template.slotId)?.slug ?? '';
  }

  /** Tradition label, e.g. "Sikh Wedding" — falls back to the category. */
  protected label(template: CatalogTemplate): string {
    return templateSeoBySlotId(template.slotId)?.label ?? template.category;
  }

  /** Name without its descriptor: "Royal Gate — Sikh Wedding" → "Royal Gate". */
  protected shortName(template: CatalogTemplate): string {
    return template.name.split(' — ')[0];
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

  /** Play videos while at least half on screen, pause them otherwise. Browser only. */
  private observeVideos(): void {
    if (!this.window || typeof IntersectionObserver === 'undefined') return;
    const observer = (this.observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.muted = true;
            video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.5 },
    ));
    for (const { nativeElement } of this.cardVideos()) {
      if (this.observed.has(nativeElement)) continue;
      this.observed.add(nativeElement);
      observer.observe(nativeElement);
    }
  }
}
