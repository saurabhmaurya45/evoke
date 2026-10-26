import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { WINDOW } from '../../../core/tokens/window.token';
import type { TemplateData, TemplateDocument } from '../models/template-schema.model';
import type { TemplateRepository } from './template-repository';

interface ApiEnvelope<T> { data: T; }
interface DraftApiOut {
  eventId: string;
  data: Record<string, unknown>;
  revision: number;
  schemaVersion: number | null;
}
interface EventApiOut { id: string; slug: string; status: string; }

/** `currentRevision` from a DRAFT_CONFLICT (409) error envelope, else null. */
function conflictRevision(err: unknown): number | null {
  const e = err as { status?: number; error?: { error?: { details?: { currentRevision?: unknown } } } };
  const rev = e?.status === 409 ? e.error?.error?.details?.currentRevision : null;
  return typeof rev === 'number' ? rev : null;
}

const EVENT_CACHE_KEY = 'evoke:event-ids';
const REVISION_CACHE_KEY = 'evoke:draft-revisions';
const LOCAL_DRAFT_PREFIX = 'evoke:draft:';

/**
 * API-backed template repository. Replaces LocalStorageTemplateRepository when
 * the user is authenticated: drafts are persisted as event+draft pairs on the
 * backend. A localStorage cache maps each template slot ID to the event being
 * edited with it right now; the editor points it at a specific event (dashboard
 * "Edit") or, when starting from the template, at its unpublished draft only —
 * so one template can back several websites. Falls back to localStorage for
 * unauthenticated (preview) edits.
 */
@Injectable()
export class HttpTemplateRepository implements TemplateRepository {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly window = inject(WINDOW);

  /**
   * Saves run one at a time. Autosave can fire again while the previous PUT is still
   * in flight; both would carry the same `revision`, so the second would be rejected
   * as a conflict (and, before this queue, silently dropped).
   */
  private saveQueue: Promise<unknown> = Promise.resolve();

  saveDraft(document: TemplateDocument): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.localWrite(LOCAL_DRAFT_PREFIX + document.templateId, document);
      return Promise.resolve();
    }
    const run = (): Promise<void> => this.persistDraft(document);
    const result = this.saveQueue.then(run, run);
    this.saveQueue = result.catch(() => undefined);
    return result;
  }

  private async persistDraft(document: TemplateDocument): Promise<void> {
    const eventId = await this.getOrCreateEvent(document.templateId);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.put<ApiEnvelope<DraftApiOut>>(`v1/events/${eventId}/draft`, {
            data: document.data,
            revision: this.readRevision(eventId),
            schemaVersion: document.schemaVersion,
          }),
        );
        this.storeRevision(eventId, res.data.revision);
        return;
      } catch (err) {
        // The cached revision was stale (another tab/device saved, or the cache was
        // cleared). The editor always holds the user's newest full document, so adopt
        // the server's revision and write again once; anything else is a real failure.
        const current = conflictRevision(err);
        if (attempt === 0 && current !== null) {
          this.storeRevision(eventId, current);
          continue;
        }
        throw err;
      }
    }
  }

  async loadDraft(templateId: string): Promise<TemplateDocument | null> {
    if (!this.auth.isAuthenticated()) {
      return this.localReadDraft(templateId);
    }
    const eventId = this.readEventId(templateId);
    if (!eventId) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<DraftApiOut>>(`v1/events/${eventId}/draft`),
      );
      const draft = res.data;
      if (!draft.data || Object.keys(draft.data).length === 0) return null;
      this.storeRevision(eventId, draft.revision);
      return {
        templateId,
        schemaVersion: draft.schemaVersion ?? 1,
        data: draft.data as unknown as TemplateData,
      };
    } catch {
      return null;
    }
  }

  async publish(document: TemplateDocument): Promise<{ id: string }> {
    await this.saveDraft(document);
    return { id: this.readEventId(document.templateId) ?? document.templateId };
  }

  /**
   * Edit this specific event with the template. Called by the editor page when it
   * receives an `?eventId=` query param (dashboard "Edit", checkout "Back to
   * editor"). Always overrides the cache: a user can have several websites on one
   * template, and the link names exactly which one to open.
   */
  useEvent(templateId: string, eventId: string): void {
    this.storeEventId(templateId, eventId);
  }

  /**
   * Opening the editor from the template itself ("Use this template") resumes only
   * an unpublished draft. If the cached event is already live (or archived, or
   * gone), forget it so the next save starts a new website rather than editing
   * the published one.
   */
  async startFromTemplate(templateId: string): Promise<void> {
    const eventId = this.readEventId(templateId);
    if (!eventId || !this.auth.isAuthenticated()) return;
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<EventApiOut>>(`v1/events/${eventId}`),
      );
      if (res.data.status !== 'DRAFT') this.forgetEventId(templateId);
    } catch (err) {
      // 404/403: not this user's event any more. A network error keeps the cache.
      const status = (err as { status?: number })?.status;
      if (status === 403 || status === 404) this.forgetEventId(templateId);
    }
  }

  /**
   * The backend event this template's draft belongs to, creating it on first
   * use. Media uploads are owned by an event, so the editor needs it before the
   * first autosave has happened.
   */
  ensureEventId(templateId: string): Promise<string> {
    return this.getOrCreateEvent(templateId);
  }

  private async getOrCreateEvent(templateId: string): Promise<string> {
    const cached = this.readEventId(templateId);
    if (cached) return cached;
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<EventApiOut>>('v1/events', {
        type: 'WEDDING',
        title: templateId,
      }),
    );
    const eventId = res.data.id;
    this.storeEventId(templateId, eventId);
    return eventId;
  }

  private readEventId(templateId: string): string | null {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(EVENT_CACHE_KEY) ?? '{}',
      ) as Record<string, string>;
      return map[templateId] ?? null;
    } catch {
      return null;
    }
  }

  private storeEventId(templateId: string, eventId: string): void {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(EVENT_CACHE_KEY) ?? '{}',
      ) as Record<string, string>;
      map[templateId] = eventId;
      this.window?.localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(map));
    } catch {}
  }

  private forgetEventId(templateId: string): void {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(EVENT_CACHE_KEY) ?? '{}',
      ) as Record<string, string>;
      delete map[templateId];
      this.window?.localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(map));
    } catch {}
  }

  /** Draft revisions are per event: two websites on one template save independently. */
  private readRevision(eventId: string): number {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(REVISION_CACHE_KEY) ?? '{}',
      ) as Record<string, number>;
      return map[eventId] ?? 0;
    } catch {
      return 0;
    }
  }

  private storeRevision(eventId: string, revision: number): void {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(REVISION_CACHE_KEY) ?? '{}',
      ) as Record<string, number>;
      map[eventId] = revision;
      this.window?.localStorage.setItem(REVISION_CACHE_KEY, JSON.stringify(map));
    } catch {}
  }

  private localWrite(key: string, value: unknown): void {
    try {
      this.window?.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  private localReadDraft(templateId: string): TemplateDocument | null {
    try {
      const raw = this.window?.localStorage.getItem(LOCAL_DRAFT_PREFIX + templateId);
      return raw ? (JSON.parse(raw) as TemplateDocument) : null;
    } catch {
      return null;
    }
  }
}
