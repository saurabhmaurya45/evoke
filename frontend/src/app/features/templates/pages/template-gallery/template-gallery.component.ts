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
import { RouterLink } from '@angular/router';
import { TemplateCardComponent } from '../../components/template-card/template-card.component';
import { SeoService } from '../../../../core/services/seo.service';
import {
  CORE_KEYWORDS,
  OCCASION_KEYWORDS,
  TEMPLATE_KEYWORDS,
} from '../../../../core/constants/seo.constants';
import { templateSeoBySlotId } from '../../data/template-seo.data';
import { environment } from '../../../../../environments/environment';

/** Questions answered on the page — also emitted as FAQPage structured data. */
const GALLERY_FAQS: readonly { question: string; answer: string }[] = [
  {
    question: 'What is a wedding invitation website?',
    answer:
      'It is your invitation as a single web page instead of a printed or PDF card. Guests open one link and see the couple, every function with its date, time and venue map, your photos and music, a countdown, and a way to RSVP.',
  },
  {
    question: 'Can I see a template with my own details before publishing?',
    answer:
      'Yes. Every template opens in a live editor: as you type names, dates and venues the preview updates instantly, so you see exactly what your guests will get before you publish.',
  },
  {
    question: 'Do guests need to install an app?',
    answer:
      'No. The invitation is a link that opens in any phone or computer browser, so it works for every guest — including elders who only use WhatsApp.',
  },
  {
    question: 'How do guests RSVP?',
    answer:
      'From the invitation itself. Guests fill in their name and which functions they will attend, and the reply comes to you on WhatsApp.',
  },
  {
    question: 'Are the templates free?',
    answer:
      'Several designs are free to publish, and premium designs show their price on the template card. You can preview and personalise any template before deciding.',
  },
];

/** Tradition and occasion pages, linked from the gallery for guests browsing by community. */
const TRADITION_LINKS: readonly { path: string; label: string }[] = [
  { path: '/wedding-invitations', label: 'Wedding Invitations' },
  { path: '/wedding-invitations/hindu', label: 'Hindu Wedding Invitations' },
  { path: '/wedding-invitations/punjabi', label: 'Punjabi Wedding Invitations' },
  { path: '/wedding-invitations/sikh', label: 'Sikh (Anand Karaj) Invitations' },
  { path: '/wedding-invitations/muslim-nikah', label: 'Nikah Invitations' },
  { path: '/wedding-invitations/south-indian', label: 'South Indian Wedding Invitations' },
  { path: '/wedding-invitations/christian', label: 'Christian Wedding Invitations' },
  { path: '/engagement-invitations', label: 'Engagement Invitations' },
  { path: '/blog', label: 'Invitation wording & ideas' },
];

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
  imports: [TemplateCardComponent, RouterLink],
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

  protected readonly faqs = GALLERY_FAQS;
  protected readonly traditionLinks = TRADITION_LINKS;

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
      this.seo.faqSchema(GALLERY_FAQS),
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
