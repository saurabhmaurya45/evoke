import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { FieldSchema, FieldValue } from '../../models/template-schema.model';
import { ImageOptimizerService } from '../../data/image-optimizer.service';
import { EditorMediaService } from '../../data/editor-media.service';
import { MediaUploadError } from '../../../../core/services/media-upload.service';

/**
 * Renders one editable control for a {@link FieldSchema}, dispatching on its
 * type. Presentational and value-driven: it takes the current value in and
 * emits changes out (`valueChange`), so the parent form engine owns state and
 * writes straight to the store. Not used for `list` fields (handled inline by
 * the form engine).
 */
@Component({
  selector: 'app-field-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <span class="field__label">
        {{ field().label }}
        @if (field().required) {
          <span class="field__req" aria-hidden="true">*</span>
        }
      </span>

      @switch (field().type) {
        @case ('textarea') {
          <textarea
            class="field__input field__input--area"
            rows="4"
            [attr.aria-label]="field().label"
            [placeholder]="field().placeholder ?? ''"
            [value]="text()"
            (input)="emitText($event)"
          ></textarea>
        }
        @case ('date') {
          <input
            class="field__input"
            type="date"
            [attr.aria-label]="field().label"
            [value]="text()"
            (input)="emitText($event)"
          />
        }
        @case ('color') {
          <input
            class="field__input field__input--color"
            type="color"
            [attr.aria-label]="field().label"
            [value]="text() || '#000000'"
            (input)="emitText($event)"
          />
        }
        @case ('toggle') {
          <input
            class="field__toggle"
            type="checkbox"
            [attr.aria-label]="field().label"
            [checked]="bool()"
            (change)="emitBool($event)"
          />
        }
        @case ('image') {
          <div class="field__image">
            @if (text()) {
              <img class="field__thumb" [src]="text()" alt="" />
            }
            <div class="field__image-controls">
              <label class="field__upload">
                <input
                  class="field__file"
                  type="file"
                  accept="image/*"
                  [attr.aria-label]="field().label + ' — upload'"
                  (change)="emitFile($event)"
                />
                <span>{{ busyLabel() ?? (text() ? 'Change image' : 'Upload image') }}</span>
              </label>
              @if (text()) {
                <button type="button" class="field__remove-img" (click)="clear()">Remove</button>
              }
            </div>
            @if (uploadError(); as error) {
              <p class="field__error" role="alert">{{ error }}</p>
            }
            <input
              class="field__input"
              type="url"
              [attr.aria-label]="field().label + ' — URL'"
              [placeholder]="field().placeholder ?? '…or paste an image URL'"
              [value]="isDataUrl() ? '' : text()"
              (input)="emitText($event)"
            />
          </div>
        }
        @case ('audio') {
          <div class="field__image">
            @if (text()) {
              <audio class="field__audio" [src]="text()" controls></audio>
            }
            <div class="field__image-controls">
              <label class="field__upload">
                <input
                  class="field__file"
                  type="file"
                  accept="audio/*"
                  [attr.aria-label]="field().label + ' — upload'"
                  (change)="emitAudioFile($event)"
                />
                <span>{{ busyLabel() ?? (text() ? 'Change music' : 'Upload music') }}</span>
              </label>
              @if (text()) {
                <button type="button" class="field__remove-img" (click)="clear()">Remove</button>
              }
            </div>
            @if (uploadError(); as error) {
              <p class="field__error" role="alert">{{ error }}</p>
            }
            <input
              class="field__input"
              type="url"
              [attr.aria-label]="field().label + ' — URL'"
              [placeholder]="field().placeholder ?? '…or paste an audio URL'"
              [value]="isDataUrl() ? '' : text()"
              (input)="emitText($event)"
            />
          </div>
        }
        @default {
          <input
            class="field__input"
            type="text"
            [attr.aria-label]="field().label"
            [placeholder]="field().placeholder ?? ''"
            [value]="text()"
            (input)="emitText($event)"
          />
        }
      }
    </div>
  `,
  styleUrl: './field-control.component.scss',
})
export class FieldControlComponent {
  private readonly optimizer = inject(ImageOptimizerService);
  /** Absent outside the editor page — files are then kept inline. */
  private readonly media = inject(EditorMediaService, { optional: true });

  readonly field = input.required<FieldSchema>();
  readonly value = input<FieldValue>('');
  readonly valueChange = output<FieldValue>();

  /** True while an upload is being compressed. */
  protected readonly optimizing = signal(false);
  /** True while a file is being uploaded to media storage. */
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly busyLabel = computed(() =>
    this.optimizing() ? 'Optimizing…' : this.uploading() ? 'Uploading…' : null,
  );

  protected readonly text = computed(() => {
    const v = this.value();
    return typeof v === 'string' ? v : '';
  });
  protected readonly bool = computed(() => this.value() === true);
  /** An uploaded file is held inline as a data URL — hide it from the URL box. */
  protected readonly isDataUrl = computed(() => this.text().startsWith('data:'));

  protected emitText(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected emitBool(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).checked);
  }

  /**
   * Optimize the chosen image (≤1 MB), then upload it to media storage and emit
   * its URL — or, when signed out, emit it inline as a data URL.
   */
  protected async emitFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Allow re-selecting the same file later.
    input.value = '';
    if (!file) {
      return;
    }
    this.uploadError.set(null);
    this.optimizing.set(true);
    let dataUrl: string;
    try {
      dataUrl = await this.optimizer.optimize(file);
    } catch {
      return; // decode/read failed — leave the current value untouched
    } finally {
      this.optimizing.set(false);
    }
    if (!this.media?.canUpload()) {
      this.valueChange.emit(dataUrl);
      return;
    }
    const optimized = await dataUrlToFile(dataUrl, file.name);
    await this.uploadAndEmit(optimized, 'IMAGE', () => Promise.resolve(dataUrl));
  }

  /** Upload the chosen audio file and emit its URL (inline data URL when signed out). */
  protected async emitAudioFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.uploadError.set(null);
    if (this.media?.canUpload()) {
      await this.uploadAndEmit(normaliseAudioType(file), 'MUSIC', () => readAsDataUrl(file));
      return;
    }
    // Music is stored inline in the draft — cap it so it can't blow localStorage.
    if (file.size > MAX_AUDIO_BYTES) {
      this.valueChange.emit('');
      alert('Please choose an audio file under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.valueChange.emit(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  protected clear(): void {
    this.uploadError.set(null);
    this.valueChange.emit('');
  }

  /**
   * Upload and emit the file's URL. Where the server has no media storage
   * configured at all, fall back to keeping the file inline (`inline()`), as
   * before uploads existed — anything else is shown as an error.
   */
  private async uploadAndEmit(
    file: File,
    mediaType: 'IMAGE' | 'MUSIC',
    inline: () => Promise<string>,
  ): Promise<void> {
    this.uploading.set(true);
    try {
      this.valueChange.emit(await this.media!.upload(file, mediaType));
    } catch (err) {
      if (err instanceof MediaUploadError && err.code === 'MEDIA_STORAGE_NOT_CONFIGURED') {
        this.valueChange.emit(await inline());
        return;
      }
      this.uploadError.set(
        err instanceof MediaUploadError ? err.message : 'Upload failed — please try again.',
      );
    } finally {
      this.uploading.set(false);
    }
  }
}

/** The optimizer's data URL back as a File, so it can be uploaded. */
async function dataUrlToFile(dataUrl: string, originalName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Browsers report MP3/M4A under a few aliases; storage accepts the standard types. */
function normaliseAudioType(file: File): File {
  const aliases: Record<string, string> = {
    'audio/mp3': 'audio/mpeg',
    'audio/x-mp3': 'audio/mpeg',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/aac': 'audio/mp4',
  };
  const type = aliases[file.type];
  return type ? new File([file], file.name, { type }) : file;
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
