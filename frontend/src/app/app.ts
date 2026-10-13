import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBannerComponent } from './shared/components/consent-banner/consent-banner.component';

/** Root component — hosts the routed application shell. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ConsentBannerComponent],
  template: '<router-outlet /><app-consent-banner />',
})
export class App {}
