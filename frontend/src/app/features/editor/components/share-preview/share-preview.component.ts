import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import {
  customShareImage,
  posterPath,
  sharePhotos,
  shareText,
} from '../../../../../../api/_lib/share-meta.mjs';
import { TemplateEditorStore } from '../../data/template-editor.store';
import { SHARE_SECTION, SHARE_SECTION_KEY } from '../../data/share-section';

/** Sample photos are never shown on the real card, so they aren't shown here either. */
const SAMPLE_MEDIA_PATH = '/invitation-templates/';

/**
 * The user's link preview as WhatsApp will show it, updating as they type, plus a way back to the
 * automatic one. Shares its wording with the function that serves the real preview.
 */
@Component({
  selector: 'app-share-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="share__hint">
      Leave these empty and we'll create the preview from your details. Changes only apply to new
      shares; messages you've already sent won't change.
    </p>
    <div class="share__card" aria-label="Link preview">
      @if (image(); as src) {
        <div class="share__media" [class.share__media--names]="showNames()">
          <img class="share__backdrop" [src]="src" alt="" />
          <img class="share__image" [src]="src" alt="" />
          @if (showNames()) {
            <div class="share__overlay">
              <strong>{{ text().names }}</strong>
              @if (text().date) {
                <span>{{ text().date }}</span>
              }
            </div>
          }
        </div>
      }
      <div class="share__body">
        <strong class="share__title">{{ text().title }}</strong>
        <span class="share__description">{{ text().description }}</span>
        <span class="share__domain">theinvitely.in</span>
      </div>
    </div>
    @if (hasCustom()) {
      <button type="button" class="share__reset" (click)="reset()">Back to default</button>
    }
  `,
  styleUrl: './share-preview.component.scss',
})
export class SharePreviewComponent {
  private readonly store = inject(TemplateEditorStore);
  private readonly templateId = computed(() => this.store.schema()?.id ?? '');

  protected readonly text = computed(() => shareText(this.templateId(), this.store.data()));

  private readonly customImage = computed(() => customShareImage(this.store.data()));

  protected readonly image = computed(() => {
    const photo = sharePhotos(this.templateId(), this.store.data()).find(
      (url) => !url.includes(SAMPLE_MEDIA_PATH),
    );
    const poster = posterPath(this.templateId());
    return this.customImage() || photo || (poster ? `${environment.mediaBaseUrl}${poster}` : '');
  });

  /** A picture the user chose is shown as it is. */
  protected readonly showNames = computed(() => !this.customImage() && !!this.text().names);

  protected readonly hasCustom = computed(() => {
    const share = this.store.data()[SHARE_SECTION_KEY] ?? {};
    return SHARE_SECTION.fields.some((field) => !!share[field.key]);
  });

  protected reset(): void {
    for (const field of SHARE_SECTION.fields) {
      this.store.setField(SHARE_SECTION_KEY, field.key, '');
    }
  }
}
