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
                <span>{{ optimizing() ? 'Optimizing…' : text() ? 'Change image' : 'Upload image' }}</span>
              </label>
              @if (text()) {
                <button type="button" class="field__remove-img" (click)="clear()">Remove</button>
              }
            </div>
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
                <span>{{ text() ? 'Change music' : 'Upload music' }}</span>
              </label>
              @if (text()) {
                <button type="button" class="field__remove-img" (click)="clear()">Remove</button>
              }
            </div>
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

  readonly field = input.required<FieldSchema>();
  readonly value = input<FieldValue>('');
  readonly valueChange = output<FieldValue>();

  /** True while an upload is being compressed. */
  protected readonly optimizing = signal(false);

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

  /** Optimize the chosen image (≤1 MB) and emit it as the field value. */
  protected emitFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Allow re-selecting the same file later.
    input.value = '';
    if (!file) {
      return;
    }
    this.optimizing.set(true);
    this.optimizer
      .optimize(file)
      .then((dataUrl) => this.valueChange.emit(dataUrl))
      .catch(() => {
        /* decode/read failed — leave the current value untouched */
      })
      .finally(() => this.optimizing.set(false));
  }

  /** Read the chosen audio file as a data URL and emit it as the field value. */
  protected emitAudioFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
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
    this.valueChange.emit('');
  }
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
