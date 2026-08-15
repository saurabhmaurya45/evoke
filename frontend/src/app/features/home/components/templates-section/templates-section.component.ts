import {
  ChangeDetectionStrategy,
  Component,
  type AfterViewInit,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { TemplateCatalogService } from '../../../templates/data/template-catalog.service';

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
export class TemplatesSectionComponent implements AfterViewInit {
  private readonly catalog = inject(TemplateCatalogService);

  /** Only published templates reach the public carousel. */
  protected readonly templates = this.catalog.published;

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);

  ngAfterViewInit(): void {
    this.onScroll();
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
