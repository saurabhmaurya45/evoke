import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export type BackendPaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type BackendEventStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PriceQuote {
  readonly eventId: string;
  readonly eventSlug: string;
  readonly eventStatus: BackendEventStatus;
  readonly templateId: string;
  readonly templateSlug: string;
  readonly templateName: string;
  readonly pricingModel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly paymentRequired: boolean;
  readonly alreadyPaid: boolean;
}

export interface CheckoutResult {
  readonly paymentRequired: boolean;
  readonly paymentId: string | null;
  readonly checkoutUrl: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly event: { readonly id: string; readonly slug: string; readonly status: BackendEventStatus };
}

export interface Payment {
  readonly id: string;
  readonly eventId: string;
  readonly templateName: string | null;
  readonly status: BackendPaymentStatus;
  readonly amountMinor: number;
  readonly currency: string;
  readonly checkoutUrl: string | null;
  readonly providerPaymentId: string | null;
  readonly paidAt: string | null;
  readonly createdAt: string;
}

interface Envelope<T> {
  readonly data: T;
}

interface Page<T> {
  readonly data: T[];
}

/** Thin client for the backend `/v1/payments` API (Razorpay Payment Links). */
@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly http = inject(HttpClient);

  quote(eventId: string): Observable<PriceQuote> {
    return this.http
      .get<Envelope<PriceQuote>>('v1/payments/quote', { params: { eventId } })
      .pipe(map((res) => res.data));
  }

  /** Publishes free templates immediately; for paid ones returns a Razorpay checkout URL. */
  checkout(eventId: string): Observable<CheckoutResult> {
    return this.http
      .post<Envelope<CheckoutResult>>('v1/payments/checkout', { eventId })
      .pipe(map((res) => res.data));
  }

  get(paymentId: string): Observable<Payment> {
    return this.http.get<Envelope<Payment>>(`v1/payments/${paymentId}`).pipe(map((res) => res.data));
  }

  listMine(): Observable<Payment[]> {
    return this.http
      .get<Page<Payment>>('v1/payments', { params: { page_size: 100 } })
      .pipe(map((res) => res.data));
  }
}

export function apiErrorCode(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    return (error.error as { error?: { code?: string } } | null)?.error?.code ?? null;
  }
  return null;
}

export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}
