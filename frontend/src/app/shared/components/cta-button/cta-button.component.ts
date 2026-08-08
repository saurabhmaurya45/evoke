import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { MagneticDirective } from '../../directives/magnetic.directive';
import type { ButtonSize, ButtonVariant } from '../../types/ui.types';

/**
 * Anchor-based call-to-action. Renders an in-page fragment link with the
 * brand's variant styles and optional magnetic pull. Being an `<a>` keeps
 * it keyboard-focusable and semantically correct for navigation.
 */
@Component({
  selector: 'app-cta-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [],
  imports: [MagneticDirective],
  template: `
    <a
      class="cta"
      [class]="'cta--' + variant() + ' cta--' + size()"
      [class.cta--block]="block()"
      [href]="href()"
      [attr.aria-label]="ariaLabel() || null"
      appMagnetic
    >
      <ng-content />
    </a>
  `,
  styleUrl: './cta-button.component.scss',
})
export class CtaButtonComponent {
  readonly href = input('#');
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input('');
}
