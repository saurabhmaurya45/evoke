import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../../core/services/analytics.service';

/**
 * Asks once whether analytics/advertising cookies may be used. Nothing is
 * loaded until the visitor accepts (see AnalyticsService); the answer is
 * remembered in this browser. Never shown on couples' invitation pages.
 */
@Component({
  selector: 'app-consent-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (analytics.needsConsent()) {
      <div class="consent" role="region" aria-label="Cookie consent">
        <p>
          We use cookies to understand how people find us and to measure our ads.
          <a routerLink="/privacy">Privacy policy</a>
        </p>
        <div class="consent__actions">
          <button type="button" class="consent__btn" (click)="analytics.setConsent('denied')">
            Decline
          </button>
          <button
            type="button"
            class="consent__btn consent__btn--accept"
            (click)="analytics.setConsent('granted')"
          >
            Accept
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    @use 'abstracts' as *;

    .consent {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: $z-modal;
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      border-radius: 16px;
      background: rgba(18, 14, 9, 0.94);
      border: 1px solid rgba(201, 162, 39, 0.35);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
      color: #f3ecdd;
      backdrop-filter: blur(10px);
    }

    p {
      margin: 0;
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
    }

    a {
      color: $color-gold;
      text-decoration: underline;
    }

    .consent__actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .consent__btn {
      padding: 9px 16px;
      border-radius: $radius-pill;
      border: 1px solid rgba(243, 236, 221, 0.25);
      background: transparent;
      color: #f3ecdd;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;

      &:focus-visible {
        @include focus-ring;
      }
    }

    .consent__btn--accept {
      border-color: transparent;
      background: linear-gradient(135deg, #d5a52f, #b78120);
      color: #1a1408;
    }

    @media (width <= 560px) {
      .consent {
        flex-direction: column;
        align-items: stretch;
      }

      .consent__actions .consent__btn {
        flex: 1;
      }
    }
  `,
})
export class ConsentBannerComponent {
  protected readonly analytics = inject(AnalyticsService);
}
