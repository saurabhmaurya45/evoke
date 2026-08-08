import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Standard section header: coloured eyebrow, serif title, optional lede.
 * Keeps every section visually consistent with a single source of truth.
 */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="heading" [class.heading--start]="align() === 'start'">
      <p class="heading__eyebrow" [style.color]="accent()">{{ eyebrow() }}</p>
      <h2 class="heading__title">
        <ng-content>{{ title() }}</ng-content>
      </h2>
      @if (subtitle()) {
        <p class="heading__subtitle">{{ subtitle() }}</p>
      }
    </div>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      .heading {
        max-width: 640px;
        margin: 0 auto 56px;
        text-align: center;

        &--start {
          margin-inline: 0;
          text-align: left;
        }
      }

      .heading__eyebrow {
        font-size: 13px;
        font-weight: $fw-semibold;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 14px;
      }

      .heading__title {
        font-family: $font-serif;
        font-size: clamp(28px, 3.6vw, 42px);
        font-weight: $fw-bold;
        letter-spacing: -0.02em;
        margin: 0;
      }

      .heading__subtitle {
        font-size: 17px;
        color: rgba(var(--text-rgb), 0.6);
        margin: 16px 0 0;
      }
    `,
  ],
})
export class SectionHeadingComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly accent = input('#c9a227');
  readonly align = input<'center' | 'start'>('center');
}
