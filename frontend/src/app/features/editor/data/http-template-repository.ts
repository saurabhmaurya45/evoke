import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
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
interface EventApiOut { id: string; slug: string; }

const EVENT_CACHE_KEY = 'evoke:event-ids';
const REVISION_CACHE_KEY = 'evoke:draft-revisions';
const LOCAL_DRAFT_PREFIX = 'evoke:draft:';

/**
 * API-backed template repository. Replaces LocalStorageTemplateRepository when
 * the user is authenticated: drafts are persisted as event+draft pairs on the
 * backend, keyed by the frontend template slot ID via a localStorage event-ID
 * cache. Falls back to localStorage for unauthenticated (preview) edits.
 */
@Injectable()
export class HttpTemplateRepository implements TemplateRepository {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly window = inject(WINDOW);

  async saveDraft(document: TemplateDocument): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.localWrite(LOCAL_DRAFT_PREFIX + document.templateId, document);
      return;
    }
    const eventId = await this.getOrCreateEvent(document.templateId);
    const revision = this.readRevision(document.templateId);
    await firstValueFrom(
      this.http
        .put<ApiEnvelope<DraftApiOut>>(`v1/events/${eventId}/draft`, {
          data: document.data,
          revision,
          schemaVersion: document.schemaVersion,
        })
        .pipe(
          tap((res) => this.storeRevision(document.templateId, res.data.revision)),
          catchError(() => of(null)),
        ),
    );
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
      this.storeRevision(templateId, draft.revision);
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

  private readRevision(templateId: string): number {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(REVISION_CACHE_KEY) ?? '{}',
      ) as Record<string, number>;
      return map[templateId] ?? 0;
    } catch {
      return 0;
    }
  }

  private storeRevision(templateId: string, revision: number): void {
    try {
      const map = JSON.parse(
        this.window?.localStorage.getItem(REVISION_CACHE_KEY) ?? '{}',
      ) as Record<string, number>;
      map[templateId] = revision;
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
