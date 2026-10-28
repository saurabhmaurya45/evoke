import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeoService } from '../../../../core/services/seo.service';
import { APP_NAME, CONTACT_EMAIL, CONTACT_INSTAGRAM, CONTACT_WHATSAPP } from '../../../../core/constants/app.constants';

@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './contact-page.component.html',
})
export class ContactPageComponent {
  private readonly seo = inject(SeoService);
  protected readonly appName = APP_NAME;
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly contactWhatsapp = CONTACT_WHATSAPP;
  protected readonly contactInstagram = CONTACT_INSTAGRAM;

  constructor() {
    this.seo.apply({
      title: `Contact ${APP_NAME}`,
      description: `Get in touch with ${APP_NAME}. We're here to help with your invitation needs.`,
    });
  }
}
