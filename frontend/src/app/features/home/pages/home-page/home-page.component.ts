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
import {
  APP_DESCRIPTION,
  APP_LOGO_PATH,
  APP_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE_TEL,
} from '../../../../core/constants/app.constants';
import { HOME_KEYWORDS, ORGANISATION } from '../../../../core/constants/seo.constants';
import { environment } from '../../../../../environments/environment';
import { HomeContentService } from '../../data/home-content.service';

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

  ngOnInit(): void {
    const url = environment.appUrl;

    this.seo.apply({
      title: `Wedding Invitation Website & E-Invites | ${APP_NAME}`,
      description: APP_DESCRIPTION,
      type: 'website',
      keywords: HOME_KEYWORDS,
      url,
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
        logo: { '@type': 'ImageObject', url: `${url}${APP_LOGO_PATH}`, width: 640, height: 227 },
        description: APP_DESCRIPTION,
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE_TEL,
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
        // No SearchAction: the gallery search box doesn't read a ?q= param,
        // so the advertised search URL would land on an unfiltered page.
      },
      {
        '@type': 'WebApplication',
        '@id': `${url}/#app`,
        name: APP_NAME,
        url,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        inLanguage: ORGANISATION.language,
        description: APP_DESCRIPTION,
        publisher: { '@id': `${url}/#organization` },
        // No `offers`: this page is prerendered, and prices only arrive from the
        // backend in the browser — at build time every template reads as ₹0,
        // which would be false markup for paid templates.
      },
      this.seo.faqSchema(this.content.faqs),
    ]);
  }
}
