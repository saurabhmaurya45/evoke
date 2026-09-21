import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
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
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap, take, takeWhile, timer } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SeoService } from '../../../../core/services/seo.service';
import {
  PaymentApiService,
  type Payment,
  type PriceQuote,
  formatMoney,
  isUuid,
} from '../../data/payment-api.service';

type ResultState = 'checking' | 'success' | 'pending' | 'failed';

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 10;

/**
 * `/payment/result` — where the backend redirects after Razorpay, and where free
 * publishes land. The redirect's `status` is only a hint: the payment itself is
 * re-read (and briefly polled, in case the webhook lands after the redirect).
 */
@Component({
  selector: 'app-payment-result-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoaderComponent],
  templateUrl: './payment-result-page.component.html',
  styleUrl: '../payment-page.scss',
})
export class PaymentResultPageComponent {
  private readonly api = inject(PaymentApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = input('');
  readonly paymentId = input('');
  readonly eventId = input('');

  protected readonly state = signal<ResultState>('checking');
  protected readonly payment = signal<Payment | null>(null);
  protected readonly quote = signal<PriceQuote | null>(null);
  protected readonly copied = signal(false);

  protected readonly inviteUrl = computed(() => {
    const slug = this.quote()?.eventSlug;
    return slug ? `${environment.appUrl}/i/${slug}` : '';
  });
  protected readonly amount = computed(() => {
    const p = this.payment();
    return p ? formatMoney(p.amountMinor, p.currency) : '';
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Payment status • Evoke',
      description: 'Your invitation payment status.',
      robots: 'noindex, nofollow',
    });

    effect(() => {
      const paymentId = this.paymentId();
      const eventId = this.eventId();
      const status = this.status();
      untracked(() => this.resolve(status, paymentId, eventId));
    });
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteUrl());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard unavailable — the link is visible and selectable.
    }
  }

  private resolve(status: string, paymentId: string, eventId: string): void {
    this.state.set('checking');
    if (isUuid(eventId)) {
      this.loadQuote(eventId);
    }

    if (!isUuid(paymentId)) {
      // Free publish, or a callback we couldn't match to a payment.
      this.state.set(status === 'success' && isUuid(eventId) ? 'success' : 'failed');
      return;
    }

    timer(0, POLL_INTERVAL_MS)
      .pipe(
        take(POLL_ATTEMPTS),
        switchMap(() => this.api.get(paymentId).pipe(catchError(() => EMPTY))),
        // Only keep polling while Razorpay said "success" but we haven't recorded it yet.
        takeWhile((p) => status === 'success' && p.status === 'CREATED', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (payment) => {
          this.payment.set(payment);
          if (payment.status === 'PAID') {
            this.state.set('success');
            this.loadQuote(payment.eventId);
          } else if (status !== 'success' || payment.status !== 'CREATED') {
            this.state.set('failed');
          }
        },
        complete: () => {
          if (this.state() === 'checking') {
            this.state.set(status === 'success' ? 'pending' : 'failed');
          }
        },
      });
  }

  private loadQuote(eventId: string): void {
    this.api
      .quote(eventId)
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((quote) => this.quote.set(quote));
  }
}
