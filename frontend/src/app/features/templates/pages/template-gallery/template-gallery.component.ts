import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TemplateCatalogService } from '../../data/template-catalog.service';
import type { CatalogTemplate } from '../../data/template-catalog.service';
import { TemplateCardComponent } from '../../components/template-card/template-card.component';
import { SeoService } from '../../../../core/services/seo.service';
import {
  CORE_KEYWORDS,
  OCCASION_KEYWORDS,
  TEMPLATE_KEYWORDS,
} from '../../../../core/constants/seo.constants';
import { templateSeoBySlotId } from '../../data/template-seo.data';
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
  imports: [TemplateCardComponent],
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

  /** Prices render only once they come from the backend — never the ₹0 seed. */
  protected readonly pricesKnown = this.catalog.pricesKnown;

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
    const url = `${environment.appUrl}/templates`;
    this.seo.apply({
      title: 'Wedding Invitation Templates — Royal, Punjabi, Nikah & More',
      description:
        'Wedding & engagement invitation website templates — royal, Punjabi, Sikh, Nikah, South Indian and classic. Preview live and share on WhatsApp.',
      keywords: [...TEMPLATE_KEYWORDS, ...CORE_KEYWORDS.slice(0, 3), ...OCCASION_KEYWORDS['wedding'].slice(0, 3)],
      url,
      canonical: url,
    });
    this.seo.setStructuredData([
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: 'Wedding & Engagement Invitation Templates',
        inLanguage: 'en-IN',
        isPartOf: { '@id': `${environment.appUrl}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: this.all().map((template, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${url}/${this.slug(template)}`,
            name: template.name,
          })),
        },
      },
      this.seo.breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Templates', path: '/templates' },
      ]),
    ]);
  }

  /** URL slug of the template's own page. */
  protected slug(template: CatalogTemplate): string {
    return templateSeoBySlotId(template.slotId)?.slug ?? '';
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.activeFilter.set('All');
    this.query.set('');
  }
}
