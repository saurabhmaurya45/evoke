import { ChangeDetectionStrategy, Component, type OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

/**
 * Reusable placeholder page for not-yet-built feature routes. Title and
 * description arrive via route `data` bound to signal inputs (router
 * component-input-binding), so one component powers every stub route.
 */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="coming">
      <p class="coming__eyebrow">{{ eyebrow() }}</p>
      <h1 class="coming__title">{{ heading() }}</h1>
      <p class="coming__desc">{{ description() }}</p>
      <a class="coming__back" routerLink="/">Back to home</a>
    </section>
  `,
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly heading = input('Coming Soon');
  readonly eyebrow = input('Evoke');
  readonly description = input('This experience is on its way. Check back soon.');

  ngOnInit(): void {
    this.seo.apply({
      title: this.heading(),
      description: this.description(),
      robots: 'noindex, follow',
    });
  }
}
