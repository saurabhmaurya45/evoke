import { ChangeDetectionStrategy, Component, type OnInit, inject } from '@angular/core';
import { HeroComponent } from '../../components/hero/hero.component';
import { StatsComponent } from '../../components/stats/stats.component';
import { ServicesSectionComponent } from '../../components/services-section/services-section.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { TemplatesSectionComponent } from '../../components/templates-section/templates-section.component';
import { FeaturesSectionComponent } from '../../components/features-section/features-section.component';
import { ComparisonComponent } from '../../components/comparison/comparison.component';
import { TestimonialsComponent } from '../../components/testimonials/testimonials.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { CtaComponent } from '../../components/cta/cta.component';
import { SeoService } from '../../../../core/services/seo.service';
import { APP_DESCRIPTION, APP_NAME } from '../../../../core/constants/app.constants';

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
    PricingComponent,
    FaqComponent,
    CtaComponent,
  ],
  templateUrl: './home-page.component.html',
})
export class HomePageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.apply({
      title: `${APP_NAME} — Create Beautiful Invitation Websites in Minutes`,
      description: APP_DESCRIPTION,
      type: 'website',
      keywords: [
        'wedding invitation website',
        'engagement invitation',
        'digital invitations',
        'event management platform',
        'RSVP',
      ],
    });
    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: APP_NAME,
      applicationCategory: 'LifestyleApplication',
      description: APP_DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '49',
        priceCurrency: 'USD',
      },
    });
  }
}
