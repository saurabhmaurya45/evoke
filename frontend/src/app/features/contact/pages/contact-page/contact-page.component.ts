import { ChangeDetectionStrategy, Component, type OnInit, inject } from '@angular/core';
import { SeoService } from '../../../../core/services/seo.service';
import { environment } from '../../../../../environments/environment';
import {
  APP_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  CONTACT_WHATSAPP,
} from '../../../../core/constants/app.constants';
import { SOCIAL_LINKS } from '../../../../core/constants/navigation.constants';

/**
 * Contact page: email, phone and a WhatsApp button, plus the social profiles.
 * Everything comes from the shared contact constants, so the footer and this
 * page never disagree. Social profiles are SOCIAL_LINKS minus the email and
 * WhatsApp entries (shown as their own cards here) — add a profile there and
 * it appears on both.
 */
@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly email = CONTACT_EMAIL;
  protected readonly phone = CONTACT_PHONE;
  protected readonly phoneTel = CONTACT_PHONE_TEL;
  protected readonly whatsapp = CONTACT_WHATSAPP;
  protected readonly socials = SOCIAL_LINKS.filter(
    (link) => link.icon !== 'gmail' && link.icon !== 'whatsapp',
  );

  ngOnInit(): void {
    const url = `${environment.appUrl}/contact`;
    this.seo.apply({
      title: 'Contact Us — Email, Phone & WhatsApp',
      description: `Questions about your wedding invitation website? Contact ${APP_NAME} by email, phone or WhatsApp — we usually reply within a few hours.`,
      url,
      canonical: url,
    });
    this.seo.setStructuredData([
      {
        '@type': 'ContactPage',
        '@id': `${url}#webpage`,
        url,
        name: `Contact ${APP_NAME}`,
        mainEntity: {
          '@type': 'Organization',
          '@id': `${environment.appUrl}/#organization`,
          name: APP_NAME,
          email: CONTACT_EMAIL,
          telephone: CONTACT_PHONE_TEL,
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: CONTACT_EMAIL,
            telephone: CONTACT_PHONE_TEL,
            areaServed: 'IN',
            availableLanguage: ['English', 'Hindi'],
          },
          sameAs: this.socials.map((link) => link.href),
        },
      },
      this.seo.breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Contact', path: '/contact' },
      ]),
    ]);
  }
}
