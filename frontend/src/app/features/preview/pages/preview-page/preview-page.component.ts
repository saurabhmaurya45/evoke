import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { HomeContentService } from '../../../home/data/home-content.service';
import { SeoService } from '../../../../core/services/seo.service';

type PreviewMode = 'preview' | 'use';

/**
 * Full-screen template preview. Resolves the template from the route param
 * (bound to a signal input), then renders the rendered invitation in a
 * sandboxed iframe. `mode=use` biases the toolbar toward checkout.
 */
@Component({
  selector: 'app-preview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './preview-page.component.html',
  styleUrl: './preview-page.component.scss',
})
export class PreviewPageComponent {
  private readonly catalog = inject(HomeContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = inject(SeoService);

  /** Route param `:templateId` (a template slot id). */
  readonly templateId = input('');
  /** Query param `mode` — `use` when arriving via "Use Template". */
  readonly mode = input<PreviewMode>('preview');

  /** Resolved template, falling back to the first catalog entry. */
  protected readonly template = computed(
    () => this.catalog.templateBySlotId(this.templateId()) ?? this.catalog.templates[0],
  );

  /** Trusted iframe source for the current template. */
  protected readonly safeSrc = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.template().previewUrl),
  );

  protected readonly isUseMode = computed(() => this.mode() === 'use');

  constructor() {
    effect(() => {
      const tpl = this.template();
      this.seo.apply({
        title: `${tpl.name} — Template Preview • Evoke`,
        description: `Preview the ${tpl.name} ${tpl.category.toLowerCase()} invitation template on Evoke.`,
        robots: 'noindex, follow',
      });
    });
  }
}
