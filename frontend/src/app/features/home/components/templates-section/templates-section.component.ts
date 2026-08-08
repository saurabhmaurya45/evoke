import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { ImageSlotComponent } from '../../../../shared/components/image-slot/image-slot.component';
import { TiltDirective } from '../../../../shared/directives/tilt.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';
import { HomeContentService } from '../../data/home-content.service';

@Component({
  selector: 'app-templates-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeadingComponent,
    SectionAuraComponent,
    ImageSlotComponent,
    TiltDirective,
    RevealDirective,
    RouterLink,
  ],
  templateUrl: './templates-section.component.html',
  styleUrl: './templates-section.component.scss',
})
export class TemplatesSectionComponent {
  protected readonly content = inject(HomeContentService);
}
