import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

export type ReelStatus = 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';

export interface Reel {
  readonly available: boolean;
  readonly status: ReelStatus | null;
  readonly progress: number;
  readonly downloadUrl: string | null;
  readonly sizeBytes: number | null;
  readonly isStale: boolean;
}

interface Envelope<T> {
  readonly data: T;
}

/** Thin client for the backend `/v1/events/{id}/reel` API. */
@Injectable({ providedIn: 'root' })
export class ReelApiService {
  private readonly http = inject(HttpClient);

  get(eventId: string): Observable<Reel> {
    return this.http.get<Envelope<Reel>>(`v1/events/${eventId}/reel`).pipe(map((res) => res.data));
  }

  /** Idempotent: nothing new is queued while a render runs or the video is up to date. */
  request(eventId: string): Observable<Reel> {
    return this.http
      .post<Envelope<Reel>>(`v1/events/${eventId}/reel`, {})
      .pipe(map((res) => res.data));
  }
}
