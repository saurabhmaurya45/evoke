import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import {
  APP_DESCRIPTION,
  APP_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  CONTACT_WHATSAPP,
  COPYRIGHT_YEAR,
} from '../../constants/app.constants';
import { FOOTER_COLUMNS, SOCIAL_LINKS } from '../../constants/navigation.constants';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected readonly columns = FOOTER_COLUMNS;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly description = APP_DESCRIPTION;
  protected readonly appName = APP_NAME;
  protected readonly year = COPYRIGHT_YEAR;
  protected readonly email = CONTACT_EMAIL;
  protected readonly phone = CONTACT_PHONE;
  protected readonly phoneTel = CONTACT_PHONE_TEL;
  protected readonly whatsapp = CONTACT_WHATSAPP;
}
