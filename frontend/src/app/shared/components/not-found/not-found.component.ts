import { ChangeDetectionStrategy, Component, type OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="nf">
      <p class="nf__code">404</p>
      <h1 class="nf__title">Page not found</h1>
      <p class="nf__desc">The page you're looking for has moved or no longer exists.</p>
      <a class="nf__back" routerLink="/">Back to home</a>
    </section>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      .nf {
        max-width: $container-narrow;
        margin-inline: auto;
        padding: 200px 28px 160px;
        text-align: center;
      }
      .nf__code {
        font-family: $font-serif;
        font-size: clamp(64px, 12vw, 120px);
        font-weight: $fw-bold;
        @include gradient-text($gradient-gold);
      }
      .nf__title {
        font-family: $font-serif;
        font-size: clamp(28px, 4vw, 40px);
        font-weight: $fw-bold;
        margin: 0 0 16px;
      }
      .nf__desc {
        font-size: 17px;
        color: rgba(var(--text-rgb), 0.6);
        margin: 0 0 32px;
      }
      .nf__back {
        display: inline-block;
        font-weight: $fw-semibold;
        padding: 14px 30px;
        border-radius: $radius-pill;
        background: $gradient-brand-strong;
        color: #fff;
        box-shadow: $shadow-brand-sm;
      }
    `,
  ],
})
export class NotFoundComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Page not found • Evoke',
      description: 'The page you are looking for does not exist.',
      robots: 'noindex, nofollow',
    });
  }
}
