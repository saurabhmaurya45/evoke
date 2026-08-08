import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { APP_DESCRIPTION, APP_NAME, COPYRIGHT_YEAR } from '../../constants/app.constants';
import { FOOTER_COLUMNS, SOCIAL_LINKS } from '../../constants/navigation.constants';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected readonly columns = FOOTER_COLUMNS;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly description = APP_DESCRIPTION;
  protected readonly appName = APP_NAME;
  protected readonly year = COPYRIGHT_YEAR;

  protected href(fragment?: string): string {
    return fragment ? `#${fragment}` : '#';
  }
}
