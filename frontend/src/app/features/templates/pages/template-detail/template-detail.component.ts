import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { TEMPLATE_KEYWORDS } from '../../../../core/constants/seo.constants';
import { environment } from '../../../../../environments/environment';
import { TemplateCatalogService, formatPrice } from '../../data/template-catalog.service';
import { templateSeoBySlug } from '../../data/template-seo.data';
import { TemplateStripComponent } from '../../components/template-strip/template-strip.component';
import { NotFoundComponent } from '../../../../shared/components/not-found/not-found.component';

/**
 * One indexable page per template (/templates/:slug) — the page that ranks
 * for "<community> wedding invitation" searches. Prerendered for every slug
 * in TEMPLATE_SEO (see app.routes.server.ts). The interactive /preview route
 * stays noindex and canonicalises here.
 */
@Component({
  selector: 'app-template-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TemplateStripComponent, NotFoundComponent],
  templateUrl: './template-detail.component.html',
  styleUrls: ['../../../../shared/styles/content-page.scss', './template-detail.component.scss'],
})
export class TemplateDetailComponent {
  private readonly seo = inject(SeoService);
  private readonly catalog = inject(TemplateCatalogService);

  /** Route param, bound via component input binding. */
  readonly slug = input('');

  protected readonly info = computed(() => templateSeoBySlug(this.slug()));
  protected readonly template = computed(() => {
    const info = this.info();
    return info ? this.catalog.published().find((tpl) => tpl.slotId === info.slotId) : undefined;
  });
  protected readonly price = computed(() => {
    const tpl = this.template();
    return tpl ? formatPrice(tpl) : '';
  });

  constructor() {
    effect(() => {
      const info = this.info();
      const tpl = this.template();
      if (!info || !tpl) return;

      const path = `/templates/${info.slug}`;
      // Short name + tradition: "Temple Bells — South Indian Wedding Invitation Template".
      // (The full name's subtitle would repeat or contradict the label.)
      const title = `${tpl.name.split(' — ')[0]} — ${info.label} Invitation Template`;
      const url = `${environment.appUrl}${path}`;
      const image = `${environment.appUrl}${tpl.previewPoster ?? ''}`;
      this.seo.apply({
        title,
        description: info.summary,
        keywords: [...info.keywords, ...TEMPLATE_KEYWORDS.slice(0, 2)],
        url,
        image,
        imageAlt: `${tpl.name} ${info.label.toLowerCase()} invitation website template`,
      });
      this.seo.setStructuredData([
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: title,
          description: info.summary,
          inLanguage: 'en-IN',
          isPartOf: { '@id': `${environment.appUrl}/#website` },
          primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 560, height: 316 },
          mainEntity: {
            '@type': 'CreativeWork',
            name: tpl.name,
            genre: `${info.label} invitation`,
            description: info.summary,
            image,
            keywords: info.keywords.join(', '),
            creator: { '@id': `${environment.appUrl}/#organization` },
          },
        },
        this.seo.breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Templates', path: '/templates' },
          { name: tpl.name, path },
        ]),
      ]);
    });
  }
}
