import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from '../../../core/tokens/window.token';
import type { TemplateData, TemplateDocument } from '../models/template-schema.model';

/**
 * Persistence boundary for the editor. Deliberately transport-agnostic so the
 * current browser-storage implementation can later be swapped for an HTTP API
 * without touching the editor UI — bind {@link TEMPLATE_REPOSITORY} to a new
 * class and everything downstream keeps working.
 *
 * `Promise`-based on purpose: today it resolves synchronously from
 * localStorage, but the same signatures cover a future async API.
 */
export interface TemplateRepository {
  /** Persist an in-progress draft for a template, keyed by templateId. */
  saveDraft(document: TemplateDocument): Promise<void>;
  /** Load a saved draft's data, or `null` when none exists. */
  loadDraft(templateId: string): Promise<TemplateDocument | null>;
  /** Publish the final document (returns a shareable id / slug). */
  publish(document: TemplateDocument): Promise<{ id: string }>;
}

/** DI token the editor injects; rebind this to switch to an API later. */
export const TEMPLATE_REPOSITORY = new InjectionToken<TemplateRepository>('TEMPLATE_REPOSITORY', {
  providedIn: 'root',
  factory: () => new LocalStorageTemplateRepository(),
});

const DRAFT_PREFIX = 'evoke:draft:';
const PUBLISHED_PREFIX = 'evoke:published:';

/**
 * Browser-storage repository — the stand-in until the backend exists. SSR-safe
 * (no-ops when `window` is null) and resilient to malformed / unavailable
 * storage. Drops in behind {@link TEMPLATE_REPOSITORY}.
 */
export class LocalStorageTemplateRepository implements TemplateRepository {
  private readonly window = inject(WINDOW);

  saveDraft(document: TemplateDocument): Promise<void> {
    this.write(DRAFT_PREFIX + document.templateId, document);
    return Promise.resolve();
  }

  loadDraft(templateId: string): Promise<TemplateDocument | null> {
    const doc = this.read(DRAFT_PREFIX + templateId);
    return Promise.resolve(doc);
  }

  publish(document: TemplateDocument): Promise<{ id: string }> {
    const id = `${document.templateId}-${Date.now().toString(36)}`;
    this.write(PUBLISHED_PREFIX + id, { ...document, id });
    return Promise.resolve({ id });
  }

  private write(key: string, value: unknown): void {
    try {
      this.window?.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable / quota exceeded — degrade silently.
    }
  }

  private read(key: string): TemplateDocument | null {
    try {
      const raw = this.window?.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as TemplateDocument) : null;
    } catch {
      return null;
    }
  }
}
