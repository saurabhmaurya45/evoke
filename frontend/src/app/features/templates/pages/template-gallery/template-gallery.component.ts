import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type AfterViewChecked,
  type AfterViewInit,
  type ElementRef,
  type OnInit,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TemplateCatalogService, formatPrice } from '../../data/template-catalog.service';
import type { CatalogTemplate } from '../../data/template-catalog.service';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
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
  imports: [RouterLink, ImageSlotComponent, TiltDirective],
  templateUrl: './template-gallery.component.html',
  styleUrl: './template-gallery.component.scss',
})
export class TemplateGalleryComponent implements OnInit, AfterViewInit, AfterViewChecked {
  private readonly seo = inject(SeoService);
  private readonly catalog = inject(TemplateCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly cardVideos = viewChildren<ElementRef<HTMLVideoElement>>('vid');
  private startedVideos = new WeakSet<HTMLVideoElement>();

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

  /** Tradition label, e.g. "Sikh Wedding" — falls back to the category. */
  protected label(template: CatalogTemplate): string {
    return templateSeoBySlotId(template.slotId)?.label ?? template.category;
  }

  /** Gates play attempts until the post-hydration nudge burst (below) has finished. */
  private settled = false;

  ngAfterViewInit(): void {
    // This page is prerendered, so Angular hydrates onto server-rendered <video>
    // nodes. Hydration re-applies bound attributes (incl. the <source src>) once on
    // the client even when the value is unchanged, which the browser treats as a new
    // media resource and aborts any play() already in flight for it ("AbortError:
    // the media was removed from the document") — and every markForCheck below is
    // itself another re-application, so attempting play() *during* this burst would
    // just keep re-triggering the same abort. Let the burst run undisturbed first
    // (forcing whatever re-applications are coming to happen now), then make one
    // clean attempt per video afterward, once nothing is left to interrupt it.
    let ticks = 0;
    const id = setInterval(() => {
      this.cdr.markForCheck();
      if (++ticks < 10) return;
      clearInterval(id);
      this.settled = true;
      this.cdr.markForCheck();
    }, 100);
  }

  ngAfterViewChecked(): void {
    if (!this.settled) return;
    // Filtering/search adds cards well after the initial render too — this also
    // covers those, now that the startup race above has settled. The WeakSet keeps
    // already-playing clips from having play() called again on every CD pass.
    for (const { nativeElement } of this.cardVideos()) {
      if (this.startedVideos.has(nativeElement) || typeof nativeElement.play !== 'function') {
        continue;
      }
      this.startedVideos.add(nativeElement);
      nativeElement.muted = true;
      void nativeElement.play().catch(() => {});
    }
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.activeFilter.set('All');
    this.query.set('');
  }
}
