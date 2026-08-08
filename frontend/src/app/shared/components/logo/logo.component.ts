import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { APP_NAME } from '../../../core/constants/app.constants';

/** Brand lockup: gradient diamond + serif wordmark. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo" [style.--mark-size.px]="markSize()" [style.--word-size.px]="wordSize()">
      <span class="logo__mark" aria-hidden="true"></span>
      <span class="logo__word">{{ name }}</span>
    </span>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      .logo {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .logo__mark {
        width: var(--mark-size, 30px);
        height: var(--mark-size, 30px);
        border-radius: 9px;
        background: $gradient-logo;
        transform: rotate(45deg);
        flex-shrink: 0;
      }

      .logo__word {
        font-family: $font-serif;
        font-size: var(--word-size, 20px);
        font-weight: $fw-bold;
        letter-spacing: -0.02em;
      }
    `,
  ],
})
export class LogoComponent {
  readonly markSize = input(30);
  readonly wordSize = input(20);
  protected readonly name = APP_NAME;
}
