import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { SeoService } from '../../../../core/services/seo.service';
import { DashboardContentService, formatCurrency } from '../../data/dashboard-content.service';
import type { InvitationSite, PaymentRecord } from '../../models/dashboard.model';

/**
 * Customer dashboard: the invitation sites they have created (with the public
 * URL to share), and the payments behind them. Data comes from the seeded
 * DashboardContentService keyed by the signed-in user's id.
 */
@Component({
  selector: 'app-user-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly content = inject(DashboardContentService);
  protected readonly auth = inject(AuthService);

  protected readonly account = computed(() => {
    const user = this.auth.user();
    return user ? this.content.accountFor(user.id) : null;
  });

  protected readonly sites = computed(() => this.account()?.sites ?? []);
  protected readonly payments = computed(() => this.account()?.payments ?? []);

  protected readonly totalPaid = computed(() =>
    formatCurrency(
      this.payments()
        .filter((payment) => payment.status === 'paid')
        .reduce((sum, payment) => sum + payment.amount, 0),
    ),
  );

  protected readonly totalViews = computed(() =>
    this.sites().reduce((sum, site) => sum + site.views, 0).toLocaleString('en-IN'),
  );

  protected readonly totalRsvps = computed(() =>
    this.sites().reduce((sum, site) => sum + site.rsvps, 0).toLocaleString('en-IN'),
  );

  /** Id of the site whose URL was just copied, for the transient "Copied" label. */
  protected readonly copiedSiteId = signal<string | null>(null);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Your dashboard',
      description: 'Manage your invitation websites, payments, and RSVPs.',
      robots: 'noindex, nofollow',
    });
  }

  protected amount(payment: PaymentRecord): string {
    return formatCurrency(payment.amount);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected async copyUrl(site: InvitationSite): Promise<void> {
    try {
      await navigator.clipboard.writeText(site.url);
      this.copiedSiteId.set(site.id);
      setTimeout(() => this.copiedSiteId.set(null), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — the URL is
      // visible and selectable in the card either way.
    }
  }
}
