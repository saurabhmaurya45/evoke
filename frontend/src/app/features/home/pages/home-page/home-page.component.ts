import { ChangeDetectionStrategy, Component, type OnInit, inject } from '@angular/core';
import { HeroComponent } from '../../components/hero/hero.component';
import { StatsComponent } from '../../components/stats/stats.component';
import { ServicesSectionComponent } from '../../components/services-section/services-section.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { TemplatesSectionComponent } from '../../components/templates-section/templates-section.component';
import { FeaturesSectionComponent } from '../../components/features-section/features-section.component';
import { ComparisonComponent } from '../../components/comparison/comparison.component';
import { TestimonialsComponent } from '../../components/testimonials/testimonials.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { CtaComponent } from '../../components/cta/cta.component';
import { SeoService } from '../../../../core/services/seo.service';
import { APP_DESCRIPTION, APP_NAME } from '../../../../core/constants/app.constants';
import { HOME_KEYWORDS, ORGANISATION } from '../../../../core/constants/seo.constants';
import { environment } from '../../../../../environments/environment';
import { HomeContentService } from '../../data/home-content.service';
import { TemplateCatalogService } from '../../../templates/data/template-catalog.service';

/**
 * Home page — composition only. Each section is an isolated, single-purpose
 * component; below-the-fold sections are deferred (`@defer on viewport`) so
 * the hero paints fast and heavier UI hydrates as the user scrolls.
 */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroComponent,
    StatsComponent,
    ServicesSectionComponent,
    HowItWorksComponent,
    TemplatesSectionComponent,
    FeaturesSectionComponent,
    ComparisonComponent,
    TestimonialsComponent,
    FaqComponent,
    CtaComponent,
  ],
  templateUrl: './home-page.component.html',
})
export class HomePageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly content = inject(HomeContentService);
  private readonly catalog = inject(TemplateCatalogService);

  ngOnInit(): void {
    const url = environment.appUrl;

    this.seo.apply({
      title: `${APP_NAME} — Digital Invitation Cards & Invitation Websites`,
      description: APP_DESCRIPTION,
      type: 'website',
      keywords: HOME_KEYWORDS,
    });

    // A @graph, so Organization / WebSite / WebApplication / FAQPage are all
    // declared once and can reference each other by @id.
    this.seo.setStructuredData([
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: APP_NAME,
        legalName: ORGANISATION.legalName,
        url,
        description: APP_DESCRIPTION,
        areaServed: { '@type': 'Country', name: 'India' },
        sameAs: ORGANISATION.sameAs,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: APP_NAME,
        url,
        inLanguage: ORGANISATION.language,
        publisher: { '@id': `${url}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${url}/templates?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebApplication',
        name: APP_NAME,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description: APP_DESCRIPTION,
        publisher: { '@id': `${url}/#organization` },
        // One Offer per published template, at the price the catalog actually charges.
        offers: this.catalog.published().map((tpl) => ({
          '@type': 'Offer',
          name: tpl.name,
          price: tpl.pricing === 'paid' ? (tpl.price / 100).toFixed(2) : '0',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        })),
      },
      this.seo.faqSchema(this.content.faqs),
    ]);
  }
}
