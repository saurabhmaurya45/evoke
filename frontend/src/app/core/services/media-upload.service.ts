import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Media uploads to the private Backblaze B2 bucket — a three-step presigned flow
 * (see aidlc-docs/construction/1-1-media-upload-b2-frontend-integration.md):
 *
 *   1. POST /v1/media/upload      → presigned PUT URL
 *   2. PUT  <uploadUrl>           → file bytes straight to B2, not our backend
 *   3. POST /v1/media/upload/ack  → backend verifies the object and finalises it
 *
 * Nothing is live until step 3 is verified server-side.
 */

export type MediaOwnerKind = 'BASE' | 'USER';
export type MediaType = 'IMAGE' | 'VIDEO' | 'MUSIC';
/** Template column a BASE upload is written onto. Ignored for USER uploads. */
export type MediaTargetField = 'thumbnail' | 'preview';

export interface MediaUploadRequest {
  /** BASE: ownerId is a template id (admin only). USER: an event id the caller owns. */
  ownerKind: MediaOwnerKind;
  ownerId: string;
  mediaType: MediaType;
  contentType: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface MediaUploadOut {
  uploadId: string;
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
  /** Must be sent on the PUT exactly — the presign signature covers them. */
  requiredHeaders: Record<string, string>;
}

export interface MediaAckRequest {
  uploadId: string;
  status: 'SUCCESS' | 'FAILURE';
  failureReason?: string | null;
  targetField?: MediaTargetField;
}

export interface MediaAckOut {
  uploadId: string;
  /** Server-verified status — not an echo of what was reported. */
  status: 'PENDING' | 'UPLOADED' | 'FAILED' | 'ABANDONED';
  storagePath: string;
  /** When UPLOADED: signed URL to display the file now (valid 15 minutes). */
  url?: string | null;
}

export interface MediaUploadOptions {
  ownerKind: MediaOwnerKind;
  ownerId: string;
  mediaType: MediaType;
  targetField?: MediaTargetField;
}

/** Allowed types and size caps — mirrors backend app/media/schemas.py. SVG is excluded on purpose. */
export const MEDIA_RULES: Record<MediaType, { types: readonly string[]; maxBytes: number }> = {
  IMAGE: { types: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
  VIDEO: { types: ['video/mp4'], maxBytes: 10 * 1024 * 1024 },
  MUSIC: { types: ['audio/mpeg', 'audio/mp4'], maxBytes: 5 * 1024 * 1024 },
};

/** `accept` attribute for a file picker of the given media type. */
export function mediaAccept(mediaType: MediaType): string {
  return MEDIA_RULES[mediaType].types.join(',');
}

/**
 * A failed upload, with a message fit to show the user. `code` is the backend's
 * error code where there is one, or a client-side one (`INVALID_FILE`,
 * `STORAGE_PUT_FAILED`, `NETWORK_ERROR`).
 */
export class MediaUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Starting again from step 1 may succeed (verification failed, storage blip, network). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly http = inject(HttpClient);

  /** Client-side check for fast feedback; the backend enforces the same rules again. */
  validate(file: File, mediaType: MediaType): MediaUploadError | null {
    const rules = MEDIA_RULES[mediaType];
    if (!rules.types.includes(file.type)) {
      const allowed = rules.types.map((type) => type.split('/')[1].toUpperCase()).join(', ');
      return new MediaUploadError('INVALID_FILE', `That file type isn't supported. Use ${allowed}.`);
    }
    if (file.size > rules.maxBytes) {
      const mb = rules.maxBytes / (1024 * 1024);
      return new MediaUploadError('INVALID_FILE', `That file is too large — the limit is ${mb} MB.`);
    }
    return null;
  }

  /** Step 1: get a presigned PUT URL. */
  async requestUpload(req: MediaUploadRequest): Promise<MediaUploadOut> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ data: MediaUploadOut }>('v1/media/upload', req),
      );
      return res.data;
    } catch (err) {
      throw toUploadError(err);
    }
  }

  /**
   * Step 2: PUT the bytes straight to B2. Raw fetch, not HttpClient: this is not
   * a call to our API, so none of the interceptors (base URL, bearer token,
   * error logging) belong on it — B2 auth lives in the presigned query string.
   */
  async uploadToStorage(url: string, headers: Record<string, string>, file: File): Promise<void> {
    let res: Response;
    try {
      res = await fetch(url, { method: 'PUT', headers, body: file });
    } catch {
      throw new MediaUploadError('NETWORK_ERROR', 'Network error while uploading — please try again.', true);
    }
    if (!res.ok) {
      throw new MediaUploadError(
        'STORAGE_PUT_FAILED',
        `Upload to storage failed (HTTP ${res.status}) — please try again.`,
        true,
      );
    }
  }

  /** Step 3: report the outcome. Idempotent, so safe to retry. */
  async ackUpload(req: MediaAckRequest): Promise<MediaAckOut> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ data: MediaAckOut }>('v1/media/upload/ack', req),
      );
      return res.data;
    } catch (err) {
      // The backend reports a failed verification (object missing, or its real
      // size doesn't match) as a plain 422 from this call.
      if (err instanceof HttpErrorResponse && err.status === 422) {
        throw new MediaUploadError(
          'UPLOAD_VERIFICATION_FAILED',
          "The upload didn't complete — please try again.",
          true,
        );
      }
      throw toUploadError(err);
    }
  }

  /**
   * The whole flow for one file. Resolves with the verified result; rejects with
   * a MediaUploadError. A failed PUT is acked as FAILURE so the backend's record
   * is accurate, then rethrown.
   */
  async uploadMedia(file: File, opts: MediaUploadOptions): Promise<MediaAckOut> {
    const invalid = this.validate(file, opts.mediaType);
    if (invalid) throw invalid;

    const upload = await this.requestUpload({
      ownerKind: opts.ownerKind,
      ownerId: opts.ownerId,
      mediaType: opts.mediaType,
      contentType: file.type,
      fileName: file.name,
      fileSizeBytes: file.size,
    });

    try {
      await this.uploadToStorage(upload.uploadUrl, upload.requiredHeaders, file);
    } catch (err) {
      // Best effort — the user-facing error is the PUT failure, not this.
      await this.ackUpload({
        uploadId: upload.uploadId,
        status: 'FAILURE',
        failureReason: err instanceof Error ? err.message : 'upload failed',
      }).catch(() => undefined);
      throw err;
    }

    const ack = await this.ackUpload({
      uploadId: upload.uploadId,
      status: 'SUCCESS',
      targetField: opts.targetField,
    });
    if (ack.status !== 'UPLOADED') {
      throw new MediaUploadError(
        'UPLOAD_VERIFICATION_FAILED',
        "The upload didn't complete — please try again.",
        true,
      );
    }
    return ack;
  }
}

/** Backend error envelope → MediaUploadError with a message the user can act on. */
function toUploadError(err: unknown): MediaUploadError {
  if (!(err instanceof HttpErrorResponse)) {
    return new MediaUploadError('UNKNOWN', 'Something went wrong — please try again.', true);
  }
  const body = (err.error as { error?: { code?: string; message?: string } } | null)?.error;
  const code = body?.code ?? `HTTP_${err.status}`;
  switch (true) {
    case err.status === 0:
      return new MediaUploadError('NETWORK_ERROR', 'Network error — check your connection and try again.', true);
    case code === 'MEDIA_STORAGE_NOT_CONFIGURED':
      return new MediaUploadError(code, "Uploads aren't available right now.");
    case code === 'MEDIA_STORAGE_ERROR' || err.status === 502:
      return new MediaUploadError(code, 'Storage is having trouble — please try again in a moment.', true);
    case err.status === 401:
      return new MediaUploadError(code, 'Your session has expired — please log in again.');
    case err.status === 403:
      return new MediaUploadError(code, "You don't have permission to upload here.");
    case err.status === 404:
      return new MediaUploadError(code, "Couldn't find that template or event.");
    default:
      return new MediaUploadError(code, body?.message ?? 'Upload failed — please try again.', err.status >= 500);
  }
}
