import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

/** Circular button that flips between dark and light themes. */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [attr.aria-label]="theme.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
      [attr.aria-pressed]="!theme.isDark()"
      (click)="theme.toggle()"
    >
      <span aria-hidden="true">{{ theme.icon() }}</span>
    </button>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      .theme-toggle {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(var(--glass-rgb), 0.16);
        background: rgba(var(--glass-rgb), 0.06);
        color: var(--text);
        font-size: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background $transition-base;

        &:hover {
          background: rgba(var(--glass-rgb), 0.12);
        }
      }
    `,
  ],
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
