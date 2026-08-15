import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { SeoService } from '../../../../core/services/seo.service';
import { DashboardContentService, formatCurrency } from '../../data/dashboard-content.service';
import type { AdminCustomer, PaymentRecord } from '../../models/dashboard.model';
import {
  TemplateCatalogService,
  formatPrice,
  type CatalogTemplate,
} from '../../../templates/data/template-catalog.service';

type AdminTab = 'templates' | 'customers' | 'sites' | 'payments';

/** Working copy of the template being edited in the drawer. */
interface TemplateDraft {
  name: string;
  category: 'Wedding' | 'Engagement';
  monogram: string;
  photo: string;
  accent: string;
  pricing: 'free' | 'paid';
  /** Rupees in the form; converted to paise on save. */
  priceRupees: number;
}

/**
 * Admin dashboard: platform-wide metrics plus customers, created sites, and
 * payments. Reachable only through adminGuard — customers who reach /admin are
 * redirected to their own dashboard.
 */
@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly content = inject(DashboardContentService);
  protected readonly auth = inject(AuthService);

  private readonly catalog = inject(TemplateCatalogService);

  protected readonly tabs: readonly AdminTab[] = ['templates', 'customers', 'sites', 'payments'];
  protected readonly tab = signal<AdminTab>('templates');

  protected readonly templates = this.catalog.all;
  protected readonly price = formatPrice;

  /** slotId of the template open in the edit drawer, or null when closed. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal<TemplateDraft | null>(null);

  protected readonly editing = computed(() => {
    const id = this.editingId();
    return id ? (this.templates().find((template) => template.slotId === id) ?? null) : null;
  });

  protected readonly metrics = this.content.adminMetrics();
  protected readonly customers = this.content.adminCustomers();
  protected readonly sites = this.content.adminSites();
  protected readonly payments = this.content.adminPayments();

  protected readonly tabCount = computed(() => ({
    templates: this.templates().length,
    customers: this.customers.length,
    sites: this.sites.length,
    payments: this.payments.length,
  }));

  ngOnInit(): void {
    this.seo.apply({
      title: 'Admin dashboard',
      description: 'Platform overview — customers, invitation sites, and payments.',
      robots: 'noindex, nofollow',
    });
  }

  protected revenue(customer: AdminCustomer): string {
    return formatCurrency(customer.revenue);
  }

  protected amount(payment: PaymentRecord): string {
    return formatCurrency(payment.amount);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected togglePublished(template: CatalogTemplate): void {
    this.catalog.togglePublished(template.slotId);
  }

  /** Open the drawer with a working copy, so Cancel discards cleanly. */
  protected openEditor(template: CatalogTemplate): void {
    this.draft.set({
      name: template.name,
      category: template.category,
      monogram: template.monogram,
      photo: template.photo,
      accent: template.accent,
      pricing: template.pricing,
      priceRupees: Math.round(template.price / 100),
    });
    this.editingId.set(template.slotId);
  }

  /**
   * Immutable patch of the working copy. ngModel two-way binding would mutate
   * the draft in place, and setting the same object reference back would not
   * notify the signal — so every field writes a new object through here.
   */
  protected patch(changes: Partial<TemplateDraft>): void {
    const draft = this.draft();
    if (draft) this.draft.set({ ...draft, ...changes });
  }

  @HostListener('document:keydown.escape')
  protected closeEditor(): void {
    this.editingId.set(null);
    this.draft.set(null);
  }

  protected saveEditor(): void {
    const id = this.editingId();
    const draft = this.draft();
    if (!id || !draft) return;
    this.catalog.edit(id, {
      name: draft.name.trim() || 'Untitled template',
      category: draft.category,
      monogram: (draft.monogram.trim()[0] ?? '?').toUpperCase(),
      photo: draft.photo.trim(),
      accent: draft.accent,
      pricing: draft.pricing,
      price: Math.max(0, Math.round(Number(draft.priceRupees) || 0) * 100),
    });
    this.closeEditor();
  }

  /** Restore the seeded catalogue, discarding every admin override. */
  protected resetCatalog(): void {
    this.catalog.reset();
    this.closeEditor();
  }
}
