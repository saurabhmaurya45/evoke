import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MagneticDirective } from '../../../../shared/directives/magnetic.directive';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';

@Component({
  selector: 'app-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MagneticDirective, RevealDirective],
  templateUrl: './cta.component.html',
  styleUrl: './cta.component.scss',
})
export class CtaComponent {}
