import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { APP_NAME } from '../../../core/constants/app.constants';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Brand lockup: the theinvitely.in wordmark image. Two colour treatments
 * exist — a cream/gold version for the dark theme and a bronze/gold version
 * for the light theme, since the cream "the" is unreadable on a light bg.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img
    class="logo"
    [style.height]="height() === null ? 'var(--logo-h, 46px)' : height() + 'px'"
    [src]="src()"
    [alt]="name"
  />`,
  styles: [
    `
      .logo {
        display: block;
        width: auto;
      }
    `,
  ],
})
export class LogoComponent {
  private readonly theme = inject(ThemeService);
  /** Pixel height, or null to size from the `--logo-h` CSS variable (responsive). */
  readonly height = input<number | null>(46);
  protected readonly name = APP_NAME;
  protected readonly src = computed(() =>
    this.theme.isDark() ? 'assets/brand/logo.png' : 'assets/brand/logo-light.png',
  );
}
