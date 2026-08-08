import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { HomeContentService } from '../../data/home-content.service';

@Component({
  selector: 'app-services-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SectionAuraComponent, TiltDirective, RevealDirective],
  templateUrl: './services-section.component.html',
  styleUrl: './services-section.component.scss',
})
export class ServicesSectionComponent {
  protected readonly content = inject(HomeContentService);
}
