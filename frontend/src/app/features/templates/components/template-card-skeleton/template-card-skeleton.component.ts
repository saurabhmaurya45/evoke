import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Shimmering stand-in for a TemplateCardComponent while the catalogue loads.
 * Same footprint as the real card (phone frame, label, name, two buttons,
 * WhatsApp row), so swapping it for the real card doesn't shift the layout.
 */
@Component({
  selector: 'app-template-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="sk">
      <div class="sk__phone"><div class="sk__screen sk__shine"></div></div>
      <div class="sk__body">
        <span class="sk__bar sk__bar--label sk__shine"></span>
        <span class="sk__bar sk__bar--name sk__shine"></span>
        <div class="sk__actions">
          <span class="sk__pill sk__shine"></span>
          <span class="sk__pill sk__shine"></span>
        </div>
        <span class="sk__pill sk__shine"></span>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      :host {
        display: block;
        min-width: 0;
        --sk-base: rgba(243, 236, 221, 0.06);
        --sk-glint: rgba(243, 236, 221, 0.15);
      }
      :host-context(:root[data-theme='light']) {
        --sk-base: rgba(75, 57, 31, 0.08);
        --sk-glint: rgba(75, 57, 31, 0.17);
      }

      .sk {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .sk__phone {
        padding: 5px;
        border-radius: 26px;
        background: #0b0906;
        border: 1px solid rgba(243, 236, 221, 0.16);
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.4);
      }
      // Inside the black phone frame in both themes, so always light-on-dark.
      .sk__screen {
        --sk-base: rgba(243, 236, 221, 0.06);
        --sk-glint: rgba(243, 236, 221, 0.15);
        aspect-ratio: 3 / 5;
        border-radius: 21px;
      }
      .sk__body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-inline: 4px;
      }
      .sk__bar {
        display: block;
        border-radius: 6px;
      }
      .sk__bar--label {
        width: 55%;
        height: 10px;
      }
      .sk__bar--name {
        width: 72%;
        height: 22px;
      }
      .sk__actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 6px;
      }
      .sk__pill {
        display: block;
        height: 37px;
        border-radius: $radius-pill;
      }

      .sk__shine {
        background: linear-gradient(100deg, var(--sk-base) 30%, var(--sk-glint) 50%, var(--sk-base) 70%)
          0 0 / 250% 100%;
        animation: sk-shimmer 1.4s linear infinite;
      }
      @keyframes sk-shimmer {
        from {
          background-position: 100% 0;
        }
        to {
          background-position: -150% 0;
        }
      }
      @include reduced-motion {
        .sk__shine {
          animation: none;
        }
      }
    `,
  ],
})
export class TemplateCardSkeletonComponent {}
