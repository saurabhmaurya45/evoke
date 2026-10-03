import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { environment } from '../../../../../environments/environment';
import { LANDING_PAGES, landingPageByPath } from '../../data/landing-pages.data';
import { TemplateStripComponent } from '../../../templates/components/template-strip/template-strip.component';
import { TemplateCatalogService } from '../../../templates/data/template-catalog.service';
import { NotFoundComponent } from '../../../../shared/components/not-found/not-found.component';

/**
 * Occasion hub and community landing pages, all driven by LANDING_PAGES.
 * Hubs receive their path via route data (`page`); community pages via the
 * `:community` param, resolved as `wedding-invitations/<community>`.
 */
@Component({
  selector: 'app-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TemplateStripComponent, NotFoundComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: '../../../../shared/styles/content-page.scss',
})
export class LandingPageComponent {
  private readonly seo = inject(SeoService);
  private readonly catalog = inject(TemplateCatalogService);

  protected readonly templateCount = this.catalog.publishedCount;

  /** Hub path from route data. */
  readonly page = input('');
  /** Community slug from the `:community` route param. */
  readonly community = input('');

  protected readonly data = computed(() =>
    landingPageByPath(this.community() ? `wedding-invitations/${this.community()}` : this.page()),
  );

  protected readonly parent = computed(() => {
    const parent = this.data()?.parent;
    return parent ? landingPageByPath(parent) : undefined;
  });

  /** Sibling community pages, for cross-linking from hubs and communities alike. */
  protected readonly communities = LANDING_PAGES.filter(
    (page) => page.parent === 'wedding-invitations',
  );

  constructor() {
    effect(() => {
      const page = this.data();
      if (!page) return;
      const url = `${environment.appUrl}/${page.path}`;
      this.seo.apply({
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        url,
      });
      const parent = this.parent();
      this.seo.setStructuredData([
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: page.title,
          description: page.description,
          inLanguage: 'en-IN',
          isPartOf: { '@id': `${environment.appUrl}/#website` },
          about: { '@id': `${environment.appUrl}/#organization` },
        },
        this.seo.breadcrumbSchema([
          { name: 'Home', path: '/' },
          ...(parent ? [{ name: parent.breadcrumb, path: `/${parent.path}` }] : []),
          { name: page.breadcrumb, path: `/${page.path}` },
        ]),
        this.seo.faqSchema(page.faqs),
      ]);
    });
  }
}
