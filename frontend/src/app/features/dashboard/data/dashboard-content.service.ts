import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AdminCustomer,
  AdminMetric,
  CustomerAccount,
  InvitationSite,
  PaymentRecord,
  SiteStatus,
} from '../models/dashboard.model';

// ---------- API response shapes (camelCase from backend) ----------

interface ApiPage<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}

interface ApiEnvelope<T> {
  data: T;
}

interface UserSiteApiOut {
  id: string;
  type: string;
  title: string;
  slug: string;
  status: string;
  templateId: string | null;
  createdAt: string;
  views: number;
  rsvps: number;
}

interface UserProfileApiOut {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

interface AdminMetricsApiOut {
  customerCount: number;
  siteCount: number;
  draftCount: number;
  archivedCount: number;
}

interface AdminCustomerApiOut {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  joinedAt: string;
  eventCount: number;
}

interface AdminSiteApiOut {
  id: string;
  ownerId: string;
  ownerEmail: string;
  type: string;
  title: string;
  slug: string;
  status: string;
  templateId: string | null;
  createdAt: string;
}

interface AdminPaymentApiOut {
  id: string;
}

// ------------------------------------------------------------------

/**
 * Dashboard data service backed by the real API.
 * Exposes signals populated lazily via `loadUserData()` / `loadAdminData()`,
 * called from the respective dashboard components in `ngOnInit`. The public
 * surface (`accountFor`, `adminMetrics`, …) mirrors the old seeded service
 * so components stay unchanged.
 */
@Injectable({ providedIn: 'root' })
export class DashboardContentService {
  private readonly http = inject(HttpClient);

  private readonly _account = signal<CustomerAccount | null>(null);
  private readonly _adminMetrics = signal<readonly AdminMetric[]>([]);
  private readonly _adminCustomers = signal<readonly AdminCustomer[]>([]);
  private readonly _adminSites = signal<readonly InvitationSite[]>([]);
  private readonly _adminPayments = signal<readonly PaymentRecord[]>([]);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ---------- public API (same shape the components already use) ----------

  accountFor(_userId: string): CustomerAccount | null {
    return this._account();
  }

  adminMetrics(): readonly AdminMetric[] {
    return this._adminMetrics();
  }

  adminCustomers(): readonly AdminCustomer[] {
    return this._adminCustomers();
  }

  adminSites(): readonly InvitationSite[] {
    return this._adminSites();
  }

  adminPayments(): readonly PaymentRecord[] {
    return this._adminPayments();
  }

  /**
   * Archive (soft-delete) an event. On success the site's status is updated to
   * 'expired' in local state so the UI reflects the change immediately without a
   * full reload.
   */
  archiveEvent(eventId: string): Observable<void> {
    return this.http.delete<void>(`v1/events/${eventId}`).pipe(
      tap(() => {
        const account = this._account();
        if (account) {
          this._account.set({
            ...account,
            sites: account.sites.map((s) =>
              s.id === eventId ? { ...s, status: 'expired' as SiteStatus } : s,
            ),
          });
        }
      }),
    );
  }

  // ---------- loaders ----------

  loadUserData(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      sites: this.http.get<ApiPage<UserSiteApiOut>>('v1/users/me/sites?page_size=100'),
      profile: this.http.get<ApiEnvelope<UserProfileApiOut>>('v1/users/me'),
    }).subscribe({
      next: ({ sites, profile }) => {
        this._account.set({
          userId: profile.data.id,
          plan: 'Free',
          memberSince: profile.data.createdAt,
          sites: sites.data.map((s) => this.mapUserSite(s)),
          payments: [],
        });
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load your data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  loadAdminData(): void {
    console.log('[DashboardContent] loadAdminData() called');
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      metrics: this.http.get<ApiEnvelope<AdminMetricsApiOut>>('v1/admin/metrics'),
      customers: this.http.get<ApiPage<AdminCustomerApiOut>>('v1/admin/customers?page_size=100'),
      sites: this.http.get<ApiPage<AdminSiteApiOut>>('v1/admin/sites?page_size=100'),
      payments: this.http.get<ApiPage<AdminPaymentApiOut>>('v1/admin/payments?page_size=100'),
    }).subscribe({
      next: ({ metrics, customers, sites }) => {
        this._adminMetrics.set(this.mapMetrics(metrics.data));
        this._adminCustomers.set(customers.data.map((c) => this.mapCustomer(c)));
        this._adminSites.set(sites.data.map((s) => this.mapAdminSite(s)));
        // Payments: backend returns empty list until billing is implemented.
        this._adminPayments.set([]);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[DashboardContent] loadAdminData error:', err.status, err.message);
        this.loadError.set('Failed to load admin data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ---------- mappers ----------

  private mapUserSite(s: UserSiteApiOut): InvitationSite {
    return {
      id: s.id,
      templateId: s.templateId ?? '',
      templateName: s.title,
      occasion: this.formatType(s.type),
      status: this.mapStatus(s.status),
      url: `${environment.appUrl}/i/${s.slug}`,
      createdAt: s.createdAt,
      views: s.views,
      rsvps: s.rsvps,
    };
  }

  private mapAdminSite(s: AdminSiteApiOut): InvitationSite {
    return {
      id: s.id,
      templateId: s.templateId ?? '',
      templateName: s.title,
      occasion: this.formatType(s.type),
      status: this.mapStatus(s.status),
      url: `${environment.appUrl}/i/${s.slug}`,
      createdAt: s.createdAt,
      views: 0,
      rsvps: 0,
    };
  }

  private mapCustomer(c: AdminCustomerApiOut): AdminCustomer {
    const name =
      c.displayName ||
      [c.firstName, c.lastName].filter(Boolean).join(' ') ||
      c.email;
    return {
      userId: c.id,
      name,
      email: c.email,
      plan: 'Free',
      joinedAt: c.joinedAt,
      sites: c.eventCount,
      revenue: 0,
    };
  }

  private mapMetrics(m: AdminMetricsApiOut): AdminMetric[] {
    return [
      { label: 'Customers', value: m.customerCount.toLocaleString('en-IN') },
      { label: 'Total sites', value: m.siteCount.toLocaleString('en-IN') },
      { label: 'Active drafts', value: m.draftCount.toLocaleString('en-IN') },
      { label: 'Archived', value: m.archivedCount.toLocaleString('en-IN') },
    ];
  }

  private formatType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  private mapStatus(status: string): SiteStatus {
    if (status === 'ARCHIVED') return 'expired';
    return 'draft';
  }
}

/** Minor units -> ₹ display string. Exported so components format identically. */
export function formatCurrency(minorUnits: number): string {
  return `₹${(minorUnits / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
