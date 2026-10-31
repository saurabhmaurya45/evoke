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
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { AuthService } from '../../../../core/services/auth.service';
import {
  MediaUploadError,
  MediaUploadService,
  mediaAccept,
} from '../../../../core/services/media-upload.service';
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
  imports: [FormsModule, LoaderComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly seo = inject(SeoService);
  protected readonly content = inject(DashboardContentService);
  protected readonly auth = inject(AuthService);
  private readonly catalog = inject(TemplateCatalogService);
  private readonly media = inject(MediaUploadService);

  protected readonly tabs: readonly AdminTab[] = ['templates', 'customers', 'sites', 'payments'];
  protected readonly tab = signal<AdminTab>('templates');

  protected readonly templates = this.catalog.all;
  protected readonly price = formatPrice;

  /** The order being arranged, by slotId; null when nothing has been moved. */
  protected readonly orderDraft = signal<readonly string[] | null>(null);
  protected readonly orderSaving = signal(false);
  protected readonly orderError = signal<string | null>(null);
  /** Shown after a successful save; cleared by the next move. */
  protected readonly orderSaved = signal(false);
  private draggingId: string | null = null;

  /** The rows on screen: the catalogue, in the order being arranged if there is one. */
  protected readonly orderedTemplates = computed(() => {
    const order = this.orderDraft();
    const templates = this.templates();
    if (!order) return templates;
    const rank = new Map(order.map((slotId, i) => [slotId, i]));
    return [...templates].sort(
      (a, b) => (rank.get(a.slotId) ?? order.length) - (rank.get(b.slotId) ?? order.length),
    );
  });

  /** slotId of the template open in the edit drawer, or null when closed. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal<TemplateDraft | null>(null);

  protected readonly imageAccept = mediaAccept('IMAGE');
  /** Upload of the card image in progress, for the open template. */
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  /** Shown just after a successful upload; cleared when the drawer closes. */
  protected readonly uploadDone = signal(false);

  /** Backend id of the open template — uploads need it, and it's only known once the API answers. */
  protected readonly editingBackendId = computed(() => {
    const id = this.editingId();
    return id ? this.catalog.backendId(id) : null;
  });

  /** Uploaded image for the open template, if any — it replaces the URL below. */
  protected readonly uploadedImage = computed(() => {
    const id = this.editingId();
    return id ? this.catalog.thumbnail(id) : null;
  });

  protected readonly editing = computed(() => {
    const id = this.editingId();
    return id ? (this.templates().find((template) => template.slotId === id) ?? null) : null;
  });

  // Computed signals — re-evaluate reactively after loadAdminData() resolves.
  protected readonly metrics = computed(() => this.content.adminMetrics());
  protected readonly customers = computed(() => this.content.adminCustomers());
  protected readonly sites = computed(() => this.content.adminSites());
  protected readonly payments = computed(() => this.content.adminPayments());

  protected readonly tabCount = computed(() => ({
    templates: this.templates().length,
    customers: this.customers().length,
    sites: this.sites().length,
    payments: this.payments().length,
  }));

  ngOnInit(): void {
    this.seo.apply({
      title: 'Admin dashboard',
      description: 'Platform overview — customers, invitation sites, and payments.',
      robots: 'noindex, nofollow',
    });
    this.content.loadAdminData();
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

  /** Move a template one place up (-1) or down (+1). */
  protected moveTemplate(slotId: string, delta: -1 | 1): void {
    const order = this.orderedTemplates().map((template) => template.slotId);
    const from = order.indexOf(slotId);
    this.placeTemplate(order, from, from + delta);
  }

  protected onDragStart(slotId: string, event: DragEvent): void {
    this.draggingId = slotId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', slotId); // Firefox won't start a drag without data
    }
  }

  /** The row being dragged takes the place of the row under the pointer. */
  protected onDragOver(slotId: string, event: DragEvent): void {
    if (!this.draggingId) return;
    event.preventDefault();
    if (slotId === this.draggingId) return;
    const order = this.orderedTemplates().map((template) => template.slotId);
    this.placeTemplate(order, order.indexOf(this.draggingId), order.indexOf(slotId));
  }

  protected onDragEnd(): void {
    this.draggingId = null;
  }

  private placeTemplate(order: string[], from: number, to: number): void {
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    this.orderDraft.set(order);
    this.orderError.set(null);
    this.orderSaved.set(false);
  }

  protected async saveOrder(): Promise<void> {
    const order = this.orderDraft();
    if (!order || this.orderSaving()) return;
    this.orderSaving.set(true);
    this.orderError.set(null);
    try {
      await this.catalog.saveOrder(order);
      this.orderDraft.set(null);
      this.orderSaved.set(true);
    } catch (err) {
      const message = (err as { error?: { error?: { message?: string } } }).error?.error?.message;
      this.orderError.set(message ?? 'Could not save the order — please try again.');
    } finally {
      this.orderSaving.set(false);
    }
  }

  protected discardOrder(): void {
    this.orderDraft.set(null);
    this.orderError.set(null);
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
      // The locally configured URL, not an uploaded thumbnail's signed URL —
      // that expires in 15 minutes and must never be saved as the card image.
      photo: this.catalog.basePhoto(template.slotId),
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
    this.uploadError.set(null);
    this.uploadDone.set(false);
  }

  /**
   * Upload a new card image to storage. Saved on the backend as soon as it's
   * verified — independent of the drawer's Save / Cancel.
   */
  protected async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // let the same file be picked again after an error
    const slotId = this.editingId();
    const ownerId = this.editingBackendId();
    if (!file || !slotId || !ownerId) return;

    this.uploadError.set(null);
    this.uploadDone.set(false);
    this.uploading.set(true);
    try {
      await this.media.uploadMedia(file, {
        ownerKind: 'BASE',
        ownerId,
        mediaType: 'IMAGE',
        targetField: 'thumbnail',
      });
      await this.catalog.refreshThumbnail(slotId);
      if (this.editingId() === slotId) this.uploadDone.set(true);
    } catch (err) {
      if (this.editingId() === slotId) {
        this.uploadError.set(
          err instanceof MediaUploadError ? err.message : 'Upload failed — please try again.',
        );
      }
    } finally {
      this.uploading.set(false);
    }
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
    this.discardOrder();
    this.closeEditor();
  }
}
