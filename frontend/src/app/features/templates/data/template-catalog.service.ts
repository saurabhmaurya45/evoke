import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
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
  /** Signed, short-lived (15 min) URL of an uploaded thumbnail, or null. */
  thumbnailUrl: string | null;
  /** Ascending position set by an admin; 0 until placed. */
  displayOrder: number;
}
interface ApiPage<T> { data: T[]; }
/** Minimal backend record cached in memory for UUID lookups. */
interface BackendEntry { id: string; storefrontStatus: string; }
/** IDs a PATCH must send instead of display values (the API takes categoryId / currencyId). */
interface CatalogRefs { currencyId: string | null; categoryIds: Record<string, string>; }
/** The storefront sells in INR. */
const PAID_CURRENCY = 'INR';

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
  /** Loaded with the admin catalogue; null until then. */
  private refs: CatalogRefs | null = null;
  private refsLoading = false;

  private readonly _templates = signal<readonly CatalogTemplate[]>(this.seed());

  /**
   * slug → uploaded thumbnail from the backend. Kept apart from `_templates` so it
   * is never persisted: the URLs are signed and expire after 15 minutes, so each
   * page load takes fresh ones from the API instead.
   */
  private readonly _thumbnails = signal<Record<string, string>>({});

  /**
   * slug → position from the backend. Templates with equal positions (all of them,
   * until an admin first saves an order) keep the order they are defined in.
   */
  private readonly _orders = signal<Record<string, number>>({});

  /** The catalogue in display order, with any uploaded thumbnail standing in for the card image. */
  private readonly _withThumbnails = computed(() => {
    const thumbs = this._thumbnails();
    const orders = this._orders();
    return this._templates()
      .map((template) =>
        thumbs[template.slotId] ? { ...template, photo: thumbs[template.slotId] } : template,
      )
      .sort((a, b) => (orders[a.slotId] ?? 0) - (orders[b.slotId] ?? 0));
  });

  /**
   * True once the backend has answered with real prices. Until then every
   * template carries the seed price (free / ₹0), which must never be shown —
   * in particular not in prerendered HTML, where it would tell search engines
   * that paid designs are free. Prerender makes no API calls, so it stays false.
   */
  private readonly _pricesKnown = signal(false);
  readonly pricesKnown = this._pricesKnown.asReadonly();

  /**
   * True once the first templates request has settled — answered, empty or failed.
   * Lets views show a loading skeleton instead of the local seed list, which the
   * response may then reshuffle (unlisted templates drop out, prices appear).
   */
  private readonly _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

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
  readonly all = this._withThumbnails;

  /** Only what the public should see. */
  readonly published = computed(() =>
    this._withThumbnails().filter((template) => template.published),
  );

  /** Backend template id (UUID) for a slot — known only to admins, once the API has answered. */
  backendId(slotId: string): string | null {
    return this._backendMap()[slotId]?.id ?? null;
  }

  /** The uploaded thumbnail (signed URL) for a slot, if it has one. */
  thumbnail(slotId: string): string | null {
    return this._thumbnails()[slotId] ?? null;
  }

  /** The card image URL as configured locally, ignoring any uploaded thumbnail. */
  basePhoto(slotId: string): string {
    return this._templates().find((template) => template.slotId === slotId)?.photo ?? '';
  }

  /** Re-read one template's thumbnail after an upload, so the new image shows at once. */
  async refreshThumbnail(slotId: string): Promise<void> {
    const id = this.backendId(slotId);
    if (!id) return;
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: Pick<BackendTemplateApiOut, 'thumbnailUrl'> }>(`v1/templates/${id}`),
      );
      this.setThumbnail(slotId, res.data.thumbnailUrl);
    } catch (err) {
      console.error('[TemplateCatalog] GET template failed:', err);
    }
  }

  private setThumbnail(slotId: string, url: string | null): void {
    this._thumbnails.update((thumbs) => {
      const { [slotId]: _old, ...rest } = thumbs;
      return url ? { ...rest, [slotId]: url } : rest;
    });
  }

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
    // Resolved to categoryId / currencyId when sent (see resolveRefs).
    if (changes.category !== undefined) payload['@category'] = changes.category;
    if (changes.pricing !== undefined || changes.price !== undefined) {
      const updated = this._templates().find((template) => template.slotId === slotId);
      if (updated) {
        const paid = updated.pricing === 'paid';
        payload['pricingModel'] = paid ? 'PAID' : 'FREE';
        payload['priceAmountMinor'] = paid ? updated.price : null;
        // The backend checks the merged template: PAID needs a currency, and
        // FREE must have none — so both directions send currencyId explicitly.
        if (paid) payload['@currency'] = PAID_CURRENCY;
        else payload['currencyId'] = null;
      }
    }
    if (Object.keys(payload).length) this.sendPatch(slotId, payload);
  }

  /**
   * Save the display order. The API needs the whole catalogue, so templates the
   * backend has but this build doesn't know go last, keeping their current order.
   * Rejects if the save fails, leaving the current order as it was.
   */
  async saveOrder(slotIds: readonly string[]): Promise<void> {
    const backend = this._backendMap();
    const known = slotIds.filter((slotId) => backend[slotId]);
    const rest = Object.keys(backend).filter((slug) => !slotIds.includes(slug));
    const ordered = [...known, ...rest];
    if (!ordered.length) throw new Error('The template list has not loaded yet.');
    await firstValueFrom(
      this.http.put('v1/templates/order', { templateIds: ordered.map((slug) => backend[slug].id) }),
    );
    this._orders.set(Object.fromEntries(ordered.map((slug, i) => [slug, i + 1])));
  }

  /** Discard every admin change and return to the seeded catalogue. */
  reset(): void {
    this._templates.set(this.seed(true));
    this.persist();
  }

  /**
   * PATCH the backend now if the template's id (and, when needed, the category /
   * currency ids) are known; otherwise queue it until they load.
   */
  private sendPatch(slotId: string, payload: Record<string, string | number | null>): void {
    const backendId = this._backendMap()[slotId]?.id;
    const needsRefs = Object.keys(payload).some((k) => k.startsWith('@'));
    if (!backendId || (needsRefs && !this.refs)) {
      this.pendingPatches.set(slotId, { ...this.pendingPatches.get(slotId), ...payload });
      if (needsRefs) this.loadRefs();
      return;
    }
    const body = this.resolveRefs(payload);
    if (!Object.keys(body).length) return;
    this.http
      .patch(`v1/templates/${backendId}`, body)
      .pipe(
        catchError((err) => {
          console.error('[TemplateCatalog] PATCH failed:', err.status, err.message);
          return of(null);
        }),
      )
      .subscribe();
  }

  /** Replace display values with the ids the API expects. */
  private resolveRefs(payload: Record<string, string | number | null>): Record<string, string | number | null> {
    const body: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === '@category') {
        const id = this.refs?.categoryIds[String(value).toLowerCase()];
        if (id) body['categoryId'] = id;
        else console.error('[TemplateCatalog] unknown category:', value);
      } else if (key === '@currency') {
        if (this.refs?.currencyId) body['currencyId'] = this.refs.currencyId;
        else console.error('[TemplateCatalog] no active currency', value, '— a PAID price will be rejected');
      } else {
        body[key] = value;
      }
    }
    return body;
  }

  /** Category and currency ids, loaded once for admin edits. */
  private loadRefs(): void {
    if (this.refs || this.refsLoading) return;
    this.refsLoading = true;
    forkJoin({
      currencies: this.http.get<ApiPage<{ id: string; code: string; isActive: boolean }>>('v1/templates/currencies'),
      categories: this.http.get<ApiPage<{ id: string; slug: string; name: string }>>('v1/templates/categories'),
    })
      .pipe(catchError((err) => { console.error('[TemplateCatalog] GET currencies/categories failed:', err.status, err.message); return of(null); }))
      .subscribe((res) => {
        this.refsLoading = false;
        if (!res) return;
        const currency = res.currencies.data.find((c) => c.code === PAID_CURRENCY && c.isActive) ?? null;
        const categoryIds: Record<string, string> = {};
        for (const c of res.categories.data) {
          categoryIds[c.name.toLowerCase()] = c.id;
          categoryIds[c.slug.toLowerCase()] = c.id;
        }
        this.refs = { currencyId: currency?.id ?? null, categoryIds };
        this.flushPending();
      });
  }

  /** Send every queued admin change whose ids are now known. */
  private flushPending(): void {
    const pending = new Map(this.pendingPatches);
    this.pendingPatches.clear();
    for (const [slotId, payload] of pending) this.sendPatch(slotId, payload);
  }

  private syncFromBackend(admin: boolean): void {
    const url = `v1/templates?page_size=100${admin ? '&include_draft=true' : ''}`;
    this.http
      .get<ApiPage<BackendTemplateApiOut>>(url)
      .pipe(catchError((err) => { console.error('[TemplateCatalog] GET templates failed:', err.status, err.message); return of({ data: [] }); }))
      .subscribe((page) => {
        this._loaded.set(true);
        // A failed or empty response says nothing — keep what we have rather than hide everything.
        if (!page.data.length) return;
        // Keyed by slug, which must equal the FE slotId (e.g. 'tpl-samarpan-royal').
        const bySlug = new Map(page.data.map((t) => [t.slug, t]));
        // Slots with an admin change still waiting to reach the backend: their local
        // state is newer than this response, so it must not overwrite them.
        const pending = new Map(this.pendingPatches);
        this._thumbnails.set(
          Object.fromEntries(
            page.data.filter((t) => t.thumbnailUrl).map((t) => [t.slug, t.thumbnailUrl!]),
          ),
        );
        this._orders.set(Object.fromEntries(page.data.map((t) => [t.slug, t.displayOrder ?? 0])));
        if (admin) {
          const map: Record<string, BackendEntry> = {};
          for (const t of page.data) {
            map[t.slug] = { id: t.id, storefrontStatus: t.storefrontStatus };
          }
          this._backendMap.set(map);
          this.loadRefs(); // category / currency ids for admin edits
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
        this._pricesKnown.set(true);
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
      const override = pickEditable(stored?.[template.slotId]);
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

const EDITABLE_KEYS = ['name', 'category', 'monogram', 'photo', 'accent', 'pricing', 'price', 'published'] as const;

/**
 * The stored fields an admin can actually change. Everything else (media URLs,
 * preview links…) is owned by the template definition, so an old stored copy can
 * never shadow it — e.g. when media moved from the site to the bucket.
 */
function pickEditable(stored: Partial<CatalogTemplate> | undefined): Partial<CatalogTemplate> {
  if (!stored) return {};
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_KEYS) {
    if (stored[key] !== undefined) out[key] = stored[key];
  }
  return out as Partial<CatalogTemplate>;
}

/** Minor units -> ₹ display string, or "Free". */
export function formatPrice(template: CatalogTemplate): string {
  return template.pricing === 'free'
    ? 'Free'
    : `₹${(template.price / 100).toLocaleString('en-IN')}`;
}
