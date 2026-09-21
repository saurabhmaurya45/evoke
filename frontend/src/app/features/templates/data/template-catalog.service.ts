import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { WINDOW } from '../../../core/tokens/window.token';
import { HomeContentService } from '../../home/data/home-content.service';
import type { TemplateCard } from '../../home/models/home-content.model';

interface BackendTemplateApiOut {
  id: string;
  slug: string;
  storefrontStatus: string;
  pricingModel: 'FREE' | 'PAID';
  priceAmountMinor: number | null;
}
interface ApiPage<T> { data: T[]; }
/** Minimal backend record cached in memory for UUID lookups. */
interface BackendEntry { id: string; storefrontStatus: string; }

/** The backend is the source of truth for pricing — checkout charges what it says. */
function backendPricing(t: BackendTemplateApiOut): Pick<CatalogTemplate, 'pricing' | 'price'> {
  const paid = t.pricingModel === 'PAID' && (t.priceAmountMinor ?? 0) > 0;
  return { pricing: paid ? 'paid' : 'free', price: paid ? t.priceAmountMinor! : 0 };
}

/** A catalogue entry: the card plus the commercial state admins control. */
export interface CatalogTemplate extends TemplateCard {
  /** Hidden from the public homepage and gallery when false. */
  readonly published: boolean;
  /** Free templates ignore `price`. */
  readonly pricing: 'free' | 'paid';
  /** Minor units (paise) so money never touches floating point. */
  readonly price: number;
}

/** The fields an admin may edit. Everything else is owned by the template. */
export type TemplateEdit = Partial<
  Pick<CatalogTemplate, 'name' | 'category' | 'monogram' | 'photo' | 'accent' | 'pricing' | 'price'>
>;

/**
 * localStorage key. Persistent (not session-scoped) because these are admin
 * settings standing in for server state until the catalogue API exists.
 */
const STORAGE_KEY = 'evoke:catalog';

/**
 * Mutable template catalogue — the single source the homepage carousel, the
 * public gallery, and the admin console all read. Seeded from
 * HomeContentService (which still owns the template definitions) and overlaid
 * with the publish/pricing state an admin edits.
 *
 * Persisted to localStorage so admin edits survive reloads and browser
 * restarts, and mirrored across open tabs via the `storage` event. Swap the
 * persistence for an API and the components stay unchanged.
 */
@Injectable({ providedIn: 'root' })
export class TemplateCatalogService {
  private readonly window = inject(WINDOW);
  private readonly content = inject(HomeContentService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** slug → backend {id, status}, populated once the admin user is confirmed. */
  private readonly _backendMap = signal<Record<string, BackendEntry>>({});

  private readonly _templates = signal<readonly CatalogTemplate[]>(this.seed());

  /**
   * Admin changes made before the slug → backend id map has loaded. They are
   * merged per slot and sent as soon as the map arrives, so an early click is
   * saved rather than silently staying local (and then being overwritten by the
   * backend state).
   */
  private readonly pendingPatches = new Map<string, Record<string, string | number | null>>();

  constructor() {
    // Another tab wrote the catalogue — adopt it so every open view stays in
    // sync. `storage` only fires in tabs other than the one that wrote.
    this.window?.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        this._templates.set(this.seed());
      }
    });

    // Pull authoritative pricing for everyone; admins additionally get draft/unlisted
    // templates (for UUID lookups) and publish status. Browser-only: no API calls
    // while prerendering.
    effect(() => {
      const admin = this.auth.isAdmin();
      if (this.window) {
        this.syncFromBackend(admin);
      }
    });
  }

  /** Everything, published or not — the admin view. */
  readonly all = this._templates.asReadonly();

  /** Only what the public should see. */
  readonly published = computed(() => this._templates().filter((template) => template.published));

  readonly publishedCount = computed(() => this.published().length);

  setPublished(slotId: string, published: boolean): void {
    this.update(slotId, () => ({ published }));
  }

  togglePublished(slotId: string): void {
    const current = this._templates().find((template) => template.slotId === slotId);
    if (!current) return;
    const newPublished = !current.published;
    this.setPublished(slotId, newPublished);
    this.sendPatch(slotId, { storefrontStatus: newPublished ? 'LISTED' : 'UNLISTED' });
  }

  /** Apply an admin edit. Paid templates keep their price; free ones reset to 0. */
  edit(slotId: string, changes: TemplateEdit): void {
    this.update(slotId, (template) => {
      const pricing = changes.pricing ?? template.pricing;
      const price = pricing === 'free' ? 0 : (changes.price ?? template.price);
      return { ...changes, pricing, price };
    });
    const payload: Record<string, string | number | null> = {};
    if (changes.name !== undefined) payload['name'] = changes.name;
    if (changes.category !== undefined) payload['category'] = changes.category;
    if (changes.pricing !== undefined || changes.price !== undefined) {
      const updated = this._templates().find((template) => template.slotId === slotId);
      if (updated) {
        payload['pricingModel'] = updated.pricing === 'paid' ? 'PAID' : 'FREE';
        payload['priceAmountMinor'] = updated.pricing === 'paid' ? updated.price : null;
      }
    }
    if (Object.keys(payload).length) this.sendPatch(slotId, payload);
  }

  /** Discard every admin change and return to the seeded catalogue. */
  reset(): void {
    this._templates.set(this.seed(true));
    this.persist();
  }

  /** PATCH the backend now if the template's id is known, otherwise queue it. */
  private sendPatch(slotId: string, payload: Record<string, string | number | null>): void {
    const backendId = this._backendMap()[slotId]?.id;
    if (!backendId) {
      this.pendingPatches.set(slotId, { ...this.pendingPatches.get(slotId), ...payload });
      return;
    }
    this.http
      .patch(`v1/templates/${backendId}`, payload)
      .pipe(
        catchError((err) => {
          console.error('[TemplateCatalog] PATCH failed:', err.status, err.message);
          return of(null);
        }),
      )
      .subscribe();
  }

  private syncFromBackend(admin: boolean): void {
    const url = `v1/templates?page_size=100${admin ? '&include_draft=true' : ''}`;
    this.http
      .get<ApiPage<BackendTemplateApiOut>>(url)
      .pipe(catchError((err) => { console.error('[TemplateCatalog] GET templates failed:', err.status, err.message); return of({ data: [] }); }))
      .subscribe((page) => {
        // A failed or empty response says nothing — keep what we have rather than hide everything.
        if (!page.data.length) return;
        // Keyed by slug, which must equal the FE slotId (e.g. 'tpl-samarpan-royal').
        const bySlug = new Map(page.data.map((t) => [t.slug, t]));
        // Slots with an admin change still waiting to reach the backend: their local
        // state is newer than this response, so it must not overwrite them.
        const pending = new Map(this.pendingPatches);
        if (admin) {
          const map: Record<string, BackendEntry> = {};
          for (const t of page.data) {
            map[t.slug] = { id: t.id, storefrontStatus: t.storefrontStatus };
          }
          this._backendMap.set(map);
          this.pendingPatches.clear();
          for (const [slotId, payload] of pending) this.sendPatch(slotId, payload);
        }
        this._templates.update((templates) =>
          templates.map((t) => {
            const backend = bySlug.get(t.slotId);
            const patch = pending.get(t.slotId);
            if (!backend) {
              // The public list only contains LISTED templates, so a template absent
              // from it is hidden (unlisted, or not in the backend at all). An admin
              // response includes drafts, so absence there means nothing.
              return admin ? t : { ...t, published: false };
            }
            return {
              ...t,
              ...(patch?.['pricingModel'] === undefined ? backendPricing(backend) : {}),
              // Public response: present means LISTED. Admin (include_draft) response:
              // the status field is authoritative.
              ...(patch?.['storefrontStatus'] === undefined
                ? { published: admin ? backend.storefrontStatus === 'LISTED' : true }
                : {}),
            };
          }),
        );
        this.persist();
      });
  }

  private update(
    slotId: string,
    change: (template: CatalogTemplate) => Partial<CatalogTemplate>,
  ): void {
    this._templates.update((templates) =>
      templates.map((template) =>
        template.slotId === slotId ? { ...template, ...change(template) } : template,
      ),
    );
    this.persist();
  }

  /**
   * Build the catalogue from the template definitions, re-applying any stored
   * admin overrides. Templates are matched by slotId, so adding or removing a
   * template in HomeContentService never leaves a stale stored entry behind.
   */
  private seed(ignoreStored = false): readonly CatalogTemplate[] {
    const stored = ignoreStored ? null : this.readStored();
    return this.content.templates.map((template) => {
      const override = stored?.[template.slotId];
      return {
        ...template,
        ...override,
        published: override?.published ?? true,
        pricing: override?.pricing ?? 'free',
        price: override?.price ?? 0,
      };
    });
  }

  private readStored(): Record<string, Partial<CatalogTemplate>> | null {
    try {
      const raw = this.window?.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Partial<CatalogTemplate>>) : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      const byId = Object.fromEntries(
        this._templates().map((template) => [template.slotId, template]),
      );
      this.window?.localStorage.setItem(STORAGE_KEY, JSON.stringify(byId));
    } catch {
      // Storage unavailable — edits still apply for this page load.
    }
  }
}

/** Minor units -> ₹ display string, or "Free". */
export function formatPrice(template: CatalogTemplate): string {
  return template.pricing === 'free'
    ? 'Free'
    : `₹${(template.price / 100).toLocaleString('en-IN')}`;
}
