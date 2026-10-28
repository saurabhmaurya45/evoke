import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { WINDOW } from '../../../../core/tokens/window.token';
import { HomeContentService } from '../../../home/data/home-content.service';
import { SeoService } from '../../../../core/services/seo.service';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { templateSeoBySlotId } from '../../../templates/data/template-seo.data';

type PreviewMode = 'preview' | 'use';

/**
 * Full-screen template preview. Resolves the template from the route param
 * (bound to a signal input), then renders the rendered invitation in a
 * sandboxed iframe. Arriving via "Use" adds `#use` (older links: `?mode=use`) —
 * a fragment, not a query param, so crawlers don't see a second URL that
 * duplicates the preview page.
 */
@Component({
  selector: 'app-preview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoaderComponent],
  templateUrl: './preview-page.component.html',
  styleUrl: './preview-page.component.scss',
})
export class PreviewPageComponent {
  private readonly catalog = inject(HomeContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = inject(SeoService);
  private readonly auth = inject(AuthService);
  private readonly window = inject(WINDOW);

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

  /**
   * The iframe is added only after the first browser render. In the prerendered
   * HTML, hydration re-applies its `src` and the template would load twice.
   */
  protected readonly showFrame = signal(false);

  /** False until the template inside the iframe has loaded; a loader covers it meanwhile. */
  protected readonly frameLoaded = signal(false);

  /** "Use this template" opens the editor when signed in; otherwise it goes to
   * login first and comes back to this template's preview afterwards. */
  protected readonly useLink = computed(() =>
    this.auth.isAuthenticated() ? ['/editor', this.template().slotId] : ['/login'],
  );
  // Browser only: in the prerendered HTML the link is plain /login, so crawlers
  // don't find one /login?returnUrl=… URL per template.
  protected readonly useQueryParams = computed(() =>
    this.auth.isAuthenticated() || !this.window
      ? null
      : { returnUrl: `/preview/${this.template().slotId}#use` },
  );

  /**
   * The iframe also fires `load` for the empty about:blank document it has
   * the moment it's inserted, before `src` is applied — that one must not hide
   * the loader.
   */
  protected onFrameLoad(frame: HTMLIFrameElement): void {
    try {
      if (frame.contentWindow?.location.href === 'about:blank') return;
    } catch {
      // Cross-origin document (e.g. served from the media bucket): it's the real one.
    }
    this.frameLoaded.set(true);
  }

  constructor() {
    afterNextRender(() => this.showFrame.set(true));
    // Switching template (same component, new param) loads a new document.
    effect(() => {
      this.safeSrc();
      this.frameLoaded.set(false);
    });
    effect(() => {
      const tpl = this.template();
      const seo = templateSeoBySlotId(tpl.slotId);
      this.seo.apply({
        title: `${tpl.name} — Template Preview • theinvitely.in`,
        description: `Live preview of the ${tpl.name} invitation template — see it full-screen, then personalise it on theinvitely.in.`,
        robots: 'noindex, follow',
        // The indexable version of this template lives at /templates/:slug.
        ...(seo && { canonical: `${environment.appUrl}/templates/${seo.slug}` }),
      });
    });
  }
}
