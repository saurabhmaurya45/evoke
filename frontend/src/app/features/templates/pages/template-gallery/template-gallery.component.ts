import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TemplateCatalogService, formatPrice } from '../../data/template-catalog.service';
import type { CatalogTemplate } from '../../data/template-catalog.service';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
import { SeoService } from '../../../../core/services/seo.service';
import { CORE_KEYWORDS, OCCASION_KEYWORDS } from '../../../../core/constants/seo.constants';
import { environment } from '../../../../../environments/environment';

/** 'All' plus every category present in the catalogue. */
type Filter = string;

/**
 * Full template gallery. Reads the same catalogue as the homepage section
 * (HomeContentService) so a template added there appears here automatically,
 * and layers filtering and search on top.
 */
@Component({
  selector: 'app-template-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ImageSlotComponent, TiltDirective],
  templateUrl: './template-gallery.component.html',
  styleUrl: './template-gallery.component.scss',
})
export class TemplateGalleryComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly catalog = inject(TemplateCatalogService);

  /** Only published templates are public. */
  protected readonly all = this.catalog.published;

  /** 'All' first, then each distinct category present in the catalogue. */
  protected readonly filters = computed<readonly Filter[]>(() => [
    'All',
    ...Array.from(new Set(this.all().map((template) => template.category))),
  ]);

  protected readonly price = formatPrice;

  protected readonly activeFilter = signal<Filter>('All');
  protected readonly query = signal('');

  protected readonly visible = computed(() => {
    const filter = this.activeFilter();
    const term = this.query().trim().toLowerCase();
    return this.all().filter((template) => {
      const matchesFilter = filter === 'All' || template.category === filter;
      const matchesTerm =
        !term ||
        template.name.toLowerCase().includes(term) ||
        template.category.toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  });

  /** Per-filter counts for the chip labels. */
  protected count(filter: Filter): number {
    return filter === 'All'
      ? this.all().length
      : this.all().filter((template) => template.category === filter).length;
  }

  ngOnInit(): void {
    this.seo.apply({
      title: 'Invitation Card Templates — Wedding, Engagement & More',
      description:
        'Browse ready-to-use digital invitation card templates for weddings, engagements and every celebration. Preview any design, personalise it, and share the link on WhatsApp.',
      keywords: [...CORE_KEYWORDS, ...OCCASION_KEYWORDS['wedding'].slice(0, 6)],
      canonical: `${environment.appUrl}/templates`,
    });
    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Invitation card templates',
      inLanguage: 'en-IN',
      hasPart: this.all().map((template) => ({
        '@type': 'CreativeWork',
        name: template.name,
        genre: template.category,
      })),
    });
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.activeFilter.set('All');
    this.query.set('');
  }
}
