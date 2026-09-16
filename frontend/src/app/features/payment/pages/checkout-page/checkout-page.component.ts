import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { WINDOW } from '../../../../core/tokens/window.token';
import {
  PaymentApiService,
  type PriceQuote,
  apiErrorCode,
  formatMoney,
  isUuid,
} from '../../data/payment-api.service';

type CheckoutState = 'loading' | 'ready' | 'processing' | 'redirecting' | 'error';

/**
 * `/payment?site=<eventId>` — confirms what the user is publishing and what it costs
 * (price always comes from the backend), then either publishes a free invitation or
 * hands off to Razorpay's hosted payment page.
 */
@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './checkout-page.component.html',
  styleUrl: '../payment-page.scss',
})
export class CheckoutPageComponent {
  private readonly api = inject(PaymentApiService);
  private readonly router = inject(Router);
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  /** Query param `?site=` — the event id. */
  readonly site = input('');
  /** Query param `?template=` — the template slot id, used for the "back to editor" link. */
  readonly template = input('');

  protected readonly state = signal<CheckoutState>('loading');
  protected readonly quote = signal<PriceQuote | null>(null);
  protected readonly error = signal('');

  protected readonly price = computed(() => {
    const q = this.quote();
    return q ? formatMoney(q.amountMinor, q.currency) : '';
  });
  protected readonly isLive = computed(() => this.quote()?.eventStatus === 'PUBLISHED');
  protected readonly editorSlotId = computed(() => this.template() || this.quote()?.templateSlug || '');

  constructor() {
    inject(SeoService).apply({
      title: 'Checkout • Evoke',
      description: 'Publish your invitation website.',
      robots: 'noindex, nofollow',
    });

    effect(() => {
      const eventId = this.site();
      untracked(() => this.loadQuote(eventId));
    });
  }

  protected submit(): void {
    const q = this.quote();
    if (!q || this.state() !== 'ready') {
      return;
    }
    this.state.set('processing');
    this.error.set('');
    this.api
      .checkout(q.eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.paymentRequired && result.checkoutUrl) {
            this.state.set('redirecting');
            this.window?.location.assign(result.checkoutUrl);
            return;
          }
          void this.router.navigate(['/payment/result'], {
            queryParams: { status: 'success', eventId: result.event.id },
          });
        },
        error: (err: unknown) => {
          this.state.set('ready');
          this.error.set(this.checkoutErrorMessage(apiErrorCode(err)));
        },
      });
  }

  protected retry(): void {
    this.loadQuote(this.site());
  }

  private loadQuote(eventId: string): void {
    if (!isUuid(eventId)) {
      this.fail('We could not find the invitation to publish. Open it from your dashboard and try again.');
      return;
    }
    this.state.set('loading');
    this.error.set('');
    this.api
      .quote(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quote) => {
          this.quote.set(quote);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          const code = apiErrorCode(err);
          if (code === 'EVENT_NOT_FOUND') {
            this.fail('This invitation does not exist or was removed.');
          } else if (code === 'AUTH_FORBIDDEN') {
            this.fail('This invitation belongs to another account.');
          } else if (code === 'VALIDATION_FAILED') {
            this.fail('This invitation is not linked to a template yet, or it has been archived.');
          } else {
            this.fail('Could not load checkout details. Please try again.');
          }
        },
      });
  }

  private fail(message: string): void {
    this.error.set(message);
    this.state.set('error');
  }

  private checkoutErrorMessage(code: string | null): string {
    switch (code) {
      case 'PAYMENTS_NOT_CONFIGURED':
        return 'Online payments are not available right now. Please try again later.';
      case 'PAYMENT_PROVIDER_ERROR':
        return 'The payment gateway did not respond. Please try again.';
      default:
        return 'Something went wrong while starting checkout. Please try again.';
    }
  }
}
