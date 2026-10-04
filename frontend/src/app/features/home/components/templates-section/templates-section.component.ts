import {
  ChangeDetectionStrategy,
  Component,
  type AfterViewChecked,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { TemplateCatalogService } from '../../../templates/data/template-catalog.service';
import { TemplateCardComponent } from '../../../templates/components/template-card/template-card.component';

/**
 * Templates carousel. A native scroll-snap track (touch/trackpad swiping and
 * keyboard scrolling for free) with arrow buttons that page through it on
 * desktop. Each card is a phone-shaped preview of the template's real opening
 * (TemplateCardComponent, which also plays only the cards on screen).
 */
@Component({
  selector: 'app-templates-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeadingComponent,
    SectionAuraComponent,
    RevealDirective,
    RouterLink,
    TemplateCardComponent,
  ],
  templateUrl: './templates-section.component.html',
  styleUrl: './templates-section.component.scss',
})
export class TemplatesSectionComponent implements AfterViewChecked {
  private readonly catalog = inject(TemplateCatalogService);

  /** Only published templates reach the public carousel. */
  protected readonly templates = this.catalog.published;
  /** Prices render only once they come from the backend — never the ₹0 seed. */
  protected readonly pricesKnown = this.catalog.pricesKnown;

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private onScrollRun = false;

  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);

  ngAfterViewChecked(): void {
    if (!this.onScrollRun) {
      this.onScrollRun = true;
      this.onScroll();
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
