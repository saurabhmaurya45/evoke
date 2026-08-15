/** Lifecycle of an invitation site a customer has created. */
export type SiteStatus = 'draft' | 'published' | 'expired';

/** Payment state of a single order. */
export type PaymentStatus = 'paid' | 'pending' | 'refunded' | 'failed';

/** One invitation website belonging to a customer. */
export interface InvitationSite {
  readonly id: string;
  /** Template card id, matching the ids in templates.index.json. */
  readonly templateId: string;
  readonly templateName: string;
  readonly occasion: string;
  readonly status: SiteStatus;
  /** Public URL of the created page — the link customers share with guests. */
  readonly url: string;
  /** ISO date the site was created. */
  readonly createdAt: string;
  /** ISO date the plan expires, when the site is published. */
  readonly expiresAt?: string;
  readonly views: number;
  readonly rsvps: number;
}

/** A single payment against a plan. */
export interface PaymentRecord {
  readonly id: string;
  /** Human-facing invoice number. */
  readonly invoiceNo: string;
  readonly plan: string;
  /** Minor units (paise), so no floating-point money. */
  readonly amount: number;
  readonly currency: 'INR';
  readonly status: PaymentStatus;
  readonly method: string;
  /** ISO date of the transaction. */
  readonly paidAt: string;
  /** Site this payment unlocked, when tied to one. */
  readonly siteId?: string;
}

/** Everything one customer sees on their dashboard. */
export interface CustomerAccount {
  readonly userId: string;
  readonly plan: string;
  readonly memberSince: string;
  readonly sites: readonly InvitationSite[];
  readonly payments: readonly PaymentRecord[];
}

/** A row in the admin customer table. */
export interface AdminCustomer {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly plan: string;
  readonly joinedAt: string;
  readonly sites: number;
  /** Lifetime value in minor units. */
  readonly revenue: number;
}

/** Headline figures across the whole platform. */
export interface AdminMetric {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
  readonly hint?: string;
}
