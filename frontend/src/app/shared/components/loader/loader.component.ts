import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The app's one loading mark: two interlocking gold rings with a twinkling gem,
 * originally built for the published invitation page. Used everywhere something
 * needs to show "working on it" instead of a plain "Loading…" string — the editor,
 * checkout, payment confirmation, admin tables.
 *
 * Unopinionated about layout: it's just the animated mark plus an accessible label
 * (visually hidden by default), sized via `size`. Callers own their own backdrop /
 * centering — see `.inv-loader` on the invitation page for a full-screen example.
 */
@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ld" [class.ld--compact]="compact()" role="status" aria-live="polite">
      <svg class="ld__art" viewBox="0 0 120 84" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f8e7b0" />
            <stop offset="50%" stop-color="#d4af37" />
            <stop offset="100%" stop-color="#9a7514" />
          </linearGradient>
        </defs>
        <circle class="ld__track" cx="46" cy="50" r="24" />
        <circle class="ld__track" cx="74" cy="50" r="24" />
        <circle class="ld__ring ld__ring--left" cx="46" cy="50" r="24" [attr.stroke]="'url(#' + gradId + ')'" />
        <circle class="ld__ring ld__ring--right" cx="74" cy="50" r="24" [attr.stroke]="'url(#' + gradId + ')'" />
        <path class="ld__gem" d="M60 4 62.4 10.6 69 13 62.4 15.4 60 22 57.6 15.4 51 13 57.6 10.6Z" />
      </svg>
      @if (!compact()) {
        <span class="ld__line" aria-hidden="true"></span>
      }
      <span class="ld__sr">{{ label() }}</span>
    </div>
  `,
  styles: [
    `
      /* block (not contents): callers style the host directly (position, ::before glow,
         etc. — see the invitation page's backdrop) and that needs a real box. */
      :host {
        display: block;
      }
      .ld {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }
      .ld__art {
        width: var(--ld-size, clamp(132px, 16vw, 176px));
        height: auto;
        overflow: visible;
      }
      .ld--compact .ld__art {
        width: var(--ld-size, 34px);
      }
      .ld__track {
        fill: none;
        stroke: rgba(212, 175, 55, 0.22);
        stroke-width: 1.6;
      }
      .ld__ring {
        fill: none;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-dasharray: 151;
        stroke-dashoffset: 151;
        transform-box: fill-box;
        transform-origin: center;
        filter: drop-shadow(0 0 3px rgba(212, 175, 55, 0.45));
        animation: ld-draw 2.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
      }
      .ld__ring--left {
        transform: rotate(-90deg);
      }
      .ld__ring--right {
        transform: rotate(90deg) scaleX(-1);
        animation-delay: 0.35s;
      }
      .ld__gem {
        fill: #f8e7b0;
        transform-box: fill-box;
        transform-origin: center;
        filter: drop-shadow(0 0 4px rgba(248, 231, 176, 0.8));
        animation: ld-twinkle 2.8s ease-in-out infinite;
      }
      .ld--compact .ld__gem {
        display: none;
      }
      .ld__line {
        width: clamp(110px, 13vw, 150px);
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(212, 175, 55, 0.4) 20%,
          #fff3cf 50%,
          rgba(212, 175, 55, 0.4) 80%,
          transparent
        );
        background-size: 200% 100%;
        animation: ld-shimmer 2.8s ease-in-out infinite;
      }
      .ld__sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      @keyframes ld-draw {
        0% {
          stroke-dashoffset: 151;
          opacity: 0.35;
        }
        45%,
        60% {
          stroke-dashoffset: 0;
          opacity: 1;
        }
        100% {
          stroke-dashoffset: -151;
          opacity: 0.35;
        }
      }
      @keyframes ld-twinkle {
        0%,
        100% {
          transform: scale(0.55) rotate(0deg);
          opacity: 0.35;
        }
        50% {
          transform: scale(1) rotate(45deg);
          opacity: 1;
        }
      }
      @keyframes ld-shimmer {
        0% {
          background-position: 150% 0;
        }
        100% {
          background-position: -50% 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ld__ring {
          animation: none;
          stroke-dashoffset: 0;
        }
        .ld__gem,
        .ld__line {
          animation-duration: 6s;
        }
      }
    `,
  ],
})
export class LoaderComponent {
  /** Accessible name (visually hidden — see the surrounding page for visible copy). */
  readonly label = input('Loading');
  /** Small inline mark (no shimmer line, no gem) for tight spaces like a table cell. */
  readonly compact = input(false);

  /** Unique per instance so multiple loaders on one page don't share a gradient id. */
  protected readonly gradId = `ld-gold-${Math.random().toString(36).slice(2)}`;
}
