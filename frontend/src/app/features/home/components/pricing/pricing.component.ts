import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { MagneticDirective } from '../../../../shared/directives/magnetic.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { HomeContentService } from '../../data/home-content.service';

@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SectionAuraComponent, MagneticDirective, RevealDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  protected readonly content = inject(HomeContentService);
}
