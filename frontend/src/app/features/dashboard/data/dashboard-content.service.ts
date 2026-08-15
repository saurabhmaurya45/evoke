import { Injectable } from '@angular/core';
import type {
  AdminCustomer,
  AdminMetric,
  CustomerAccount,
  InvitationSite,
  PaymentRecord,
} from '../models/dashboard.model';

/**
 * Seeded dashboard data — the stand-in until the orders/billing API exists.
 * Mirrors HomeContentService: a single source of truth held away from the
 * presentation layer, so swapping these getters for HTTP calls later touches
 * no component. In-memory on purpose; nothing persists across a reload.
 */
@Injectable({ providedIn: 'root' })
export class DashboardContentService {
  private readonly accounts: readonly CustomerAccount[] = [
    {
      userId: 'usr-ananya',
      plan: 'Premium',
      memberSince: '2026-02-11',
      sites: [
        {
          id: 'site-ananya-1',
          templateId: 'tpl-golden-promise',
          templateName: 'Golden Promise',
          occasion: 'Wedding',
          status: 'published',
          url: 'https://evoke.page/ananya-and-rohan',
          createdAt: '2026-05-02',
          expiresAt: '2027-05-02',
          views: 1284,
          rsvps: 96,
        },
        {
          id: 'site-ananya-2',
          templateId: 'tpl-samarpan-royal',
          templateName: 'Samarpan — Royal Wedding',
          occasion: 'Engagement',
          status: 'draft',
          url: 'https://evoke.page/ananya-roka-preview',
          createdAt: '2026-07-19',
          views: 0,
          rsvps: 0,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          invoiceNo: 'EVK-2026-0417',
          plan: 'Premium — 12 months',
          amount: 499900,
          currency: 'INR',
          status: 'paid',
          method: 'UPI · HDFC ····4821',
          paidAt: '2026-05-02',
          siteId: 'site-ananya-1',
        },
        {
          id: 'pay-2',
          invoiceNo: 'EVK-2026-0688',
          plan: 'Extra guest capacity',
          amount: 99900,
          currency: 'INR',
          status: 'paid',
          method: 'Visa ····1109',
          paidAt: '2026-06-14',
          siteId: 'site-ananya-1',
        },
        {
          id: 'pay-3',
          invoiceNo: 'EVK-2026-0912',
          plan: 'Engagement add-on',
          amount: 149900,
          currency: 'INR',
          status: 'pending',
          method: 'Netbanking · ICICI',
          paidAt: '2026-07-19',
          siteId: 'site-ananya-2',
        },
      ],
    },
  ];

  private readonly customers: readonly AdminCustomer[] = [
    { userId: 'usr-ananya', name: 'Ananya Sharma', email: 'user@evoke.test', plan: 'Premium', joinedAt: '2026-02-11', sites: 2, revenue: 749700 },
    { userId: 'usr-karan', name: 'Karan Mehta', email: 'karan@example.com', plan: 'Premium', joinedAt: '2026-03-04', sites: 1, revenue: 499900 },
    { userId: 'usr-nisha', name: 'Nisha Rao', email: 'nisha@example.com', plan: 'Starter', joinedAt: '2026-04-22', sites: 1, revenue: 199900 },
    { userId: 'usr-joe', name: 'Joe Thomas', email: 'joe@example.com', plan: 'Premium', joinedAt: '2026-05-30', sites: 3, revenue: 1149700 },
    { userId: 'usr-serin', name: 'Serin Kurian', email: 'serin@example.com', plan: 'Starter', joinedAt: '2026-06-18', sites: 1, revenue: 199900 },
    { userId: 'usr-harpreet', name: 'Harpreet Kaur', email: 'harpreet@example.com', plan: 'Premium', joinedAt: '2026-07-09', sites: 2, revenue: 599800 },
  ];

  /** Every site on the platform, for the admin table. */
  private readonly allSites: readonly InvitationSite[] = [
    ...this.accounts.flatMap((account) => account.sites),
    {
      id: 'site-karan-1',
      templateId: 'tpl-karan-nisha',
      templateName: 'Maroon & Gold — Royal Hindu Wedding',
      occasion: 'Wedding',
      status: 'published',
      url: 'https://evoke.page/karan-weds-nisha',
      createdAt: '2026-03-06',
      expiresAt: '2027-03-06',
      views: 3140,
      rsvps: 212,
    },
    {
      id: 'site-joe-1',
      templateId: 'tpl-joe-serin',
      templateName: 'Doorway — Modern Wedding',
      occasion: 'Wedding',
      status: 'published',
      url: 'https://evoke.page/joe-and-serin',
      createdAt: '2026-06-01',
      expiresAt: '2027-06-01',
      views: 2077,
      rsvps: 148,
    },
    {
      id: 'site-harpreet-1',
      templateId: 'tpl-harpreet-ritika',
      templateName: 'Rosewood — Sikh Wedding',
      occasion: 'Wedding',
      status: 'expired',
      url: 'https://evoke.page/harpreet-ritika',
      createdAt: '2025-07-11',
      expiresAt: '2026-07-11',
      views: 4310,
      rsvps: 301,
    },
  ];

  /** The signed-in customer's account, or `null` when they have no orders. */
  accountFor(userId: string): CustomerAccount | null {
    return this.accounts.find((account) => account.userId === userId) ?? null;
  }

  adminMetrics(): readonly AdminMetric[] {
    const revenue = this.customers.reduce((sum, customer) => sum + customer.revenue, 0);
    const published = this.allSites.filter((site) => site.status === 'published').length;
    const rsvps = this.allSites.reduce((sum, site) => sum + site.rsvps, 0);
    return [
      { label: 'Total revenue', value: formatCurrency(revenue), delta: '+18.2%', hint: 'vs. previous 30 days' },
      { label: 'Customers', value: String(this.customers.length), delta: '+3', hint: 'new this month' },
      { label: 'Published sites', value: String(published), hint: `${this.allSites.length} created in total` },
      { label: 'RSVPs collected', value: rsvps.toLocaleString('en-IN'), hint: 'across all live invitations' },
    ];
  }

  adminCustomers(): readonly AdminCustomer[] {
    return this.customers;
  }

  adminSites(): readonly InvitationSite[] {
    return this.allSites;
  }

  /** Latest payments across every customer, newest first. */
  adminPayments(): readonly PaymentRecord[] {
    return this.accounts
      .flatMap((account) => account.payments)
      .slice()
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }
}

/** Minor units -> ₹ display string. Exported so components format identically. */
export function formatCurrency(minorUnits: number): string {
  return `₹${(minorUnits / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
