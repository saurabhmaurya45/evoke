import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBannerComponent } from './shared/components/consent-banner/consent-banner.component';
import { NavProgressComponent } from './shared/components/nav-progress/nav-progress.component';

/** Root component — hosts the routed application shell. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ConsentBannerComponent, NavProgressComponent],
  template: '<app-nav-progress /><router-outlet /><app-consent-banner />',
})
export class App {}
