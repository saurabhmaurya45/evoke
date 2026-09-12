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
  status: string;
}
interface ApiPage<T> { data: T[]; }
/** Minimal backend record cached in memory for UUID lookups. */
interface BackendEntry { id: string; status: string; }

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

  constructor() {
    // Another tab wrote the catalogue — adopt it so every open view stays in
    // sync. `storage` only fires in tabs other than the one that wrote.
    this.window?.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        this._templates.set(this.seed());
      }
    });

    // When the current user is confirmed as admin, pull the authoritative
    // publish status from the backend and merge it over the local overrides.
    effect(() => {
      const admin = this.auth.isAdmin();
      console.log('[TemplateCatalog] isAdmin =', admin);
      if (admin) {
        this.syncFromBackend();
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
    const backendId = this._backendMap()[slotId]?.id;
    console.log('[TemplateCatalog] togglePublished', slotId, '→', newPublished ? 'ACTIVE' : 'ARCHIVED', '| backendId =', backendId ?? 'NOT FOUND (backendMap empty)');
    console.log('[TemplateCatalog] full backendMap =', JSON.stringify(this._backendMap()));
    if (backendId) {
      this.http
        .patch(`v1/templates/${backendId}`, { status: newPublished ? 'ACTIVE' : 'ARCHIVED' })
        .pipe(catchError((err) => { console.error('[TemplateCatalog] PATCH failed:', err.status, err.message); return of(null); }))
        .subscribe((res) => console.log('[TemplateCatalog] PATCH response:', res));
    }
  }

  /** Apply an admin edit. Paid templates keep their price; free ones reset to 0. */
  edit(slotId: string, changes: TemplateEdit): void {
    this.update(slotId, (template) => {
      const pricing = changes.pricing ?? template.pricing;
      const price = pricing === 'free' ? 0 : (changes.price ?? template.price);
      return { ...changes, pricing, price };
    });
    const backendId = this._backendMap()[slotId]?.id;
    if (backendId) {
      const payload: Record<string, string> = {};
      if (changes.name !== undefined) payload['name'] = changes.name;
      if (changes.category !== undefined) payload['category'] = changes.category;
      if (Object.keys(payload).length) {
        this.http
          .patch(`v1/templates/${backendId}`, payload)
          .pipe(catchError(() => of(null)))
          .subscribe();
      }
    }
  }

  /** Discard every admin change and return to the seeded catalogue. */
  reset(): void {
    this._templates.set(this.seed(true));
    this.persist();
  }

  private syncFromBackend(): void {
    console.log('[TemplateCatalog] syncFromBackend() called — fetching v1/templates?include_all=true');
    this.http
      .get<ApiPage<BackendTemplateApiOut>>('v1/templates?page_size=100&include_all=true')
      .pipe(catchError((err) => { console.error('[TemplateCatalog] GET templates failed:', err.status, err.message); return of({ data: [] }); }))
      .subscribe((page) => {
        console.log('[TemplateCatalog] GET templates returned', page.data.length, 'items:', page.data.map(t => t.slug));
        if (!page.data.length) { console.warn('[TemplateCatalog] backendMap NOT populated — empty response'); return; }
        const map: Record<string, BackendEntry> = {};
        for (const t of page.data) {
          map[t.slug] = { id: t.id, status: t.status };
        }
        this._backendMap.set(map);
        console.log('[TemplateCatalog] backendMap set:', Object.keys(map));
        // Merge authoritative publish status; local overrides for other fields are kept.
        this._templates.update((templates) =>
          templates.map((t) => {
            const backend = map[t.slotId];
            return backend ? { ...t, published: backend.status === 'ACTIVE' } : t;
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
        pricing: override?.pricing ?? 'paid',
        price: override?.price ?? 149900,
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
