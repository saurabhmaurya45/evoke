import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { SectionAuraComponent } from '../../../../shared/components/section-aura/section-aura.component';
import { TemplateCardSkeletonComponent } from '../../../templates/components/template-card-skeleton/template-card-skeleton.component';

/**
 * The templates section's `@defer` placeholder: the real heading plus shimmering
 * cards, laid out with the section's own stylesheet, so visitors see the section
 * is loading (instead of an empty gap) and nothing moves when it swaps in.
 * Carries id="templates" so the hero's "Browse Templates" anchor still works.
 */
@Component({
  selector: 'app-templates-section-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SectionAuraComponent, TemplateCardSkeletonComponent],
  template: `
    <section id="templates" class="templates" aria-busy="true" aria-label="Loading templates">
      <app-section-aura tone="clay" />
      <app-section-heading
        eyebrow="Templates"
        title="Wedding invitations"
        subtitle="Choose a beautifully crafted design and make it yours."
        accent="#c97b63"
      />
      <div class="carousel">
        <span class="carousel__nav carousel__nav--idle" aria-hidden="true">‹</span>
        <div class="carousel__track carousel__track--loading">
          @for (i of slots; track i) {
            <app-template-card-skeleton />
          }
        </div>
        <span class="carousel__nav carousel__nav--idle" aria-hidden="true">›</span>
      </div>
      <div class="templates__more">
        <span class="templates__more-link templates__more-link--idle">View all templates →</span>
      </div>
    </section>
  `,
  styleUrl: './templates-section.component.scss',
})
export class TemplatesSectionSkeletonComponent {
  protected readonly slots = [0, 1, 2, 3, 4, 5];
}
