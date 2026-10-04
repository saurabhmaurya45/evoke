import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import {
  MediaUploadError,
  MediaUploadService,
  type MediaType,
} from '../../../core/services/media-upload.service';
import { HttpTemplateRepository } from './http-template-repository';
import { TEMPLATE_REPOSITORY } from './template-repository';
import { TemplateEditorStore } from './template-editor.store';

/**
 * Uploads an editor image/audio field's file to media storage (B2) and returns
 * the URL to put in the field.
 *
 * The URL is signed and short-lived; the backend stores it as the file's path
 * when the draft is saved and hands out a fresh one on every read, so the draft
 * never holds an expiring link — or a multi-megabyte base64 string.
 *
 * Only when signed in: a signed-out editor has no backend draft (or event) for
 * an upload to belong to, so `canUpload()` is false and callers keep the file
 * inline instead.
 */
@Injectable()
export class EditorMediaService {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(TEMPLATE_REPOSITORY);
  private readonly media = inject(MediaUploadService);
  private readonly store = inject(TemplateEditorStore);

  canUpload(): boolean {
    return this.auth.isAuthenticated() && this.repository instanceof HttpTemplateRepository;
  }

  /** Upload `file`; resolves with a displayable URL, rejects with a MediaUploadError. */
  async upload(file: File, mediaType: MediaType): Promise<string> {
    const templateId = this.store.schema()?.id;
    if (!templateId || !(this.repository instanceof HttpTemplateRepository)) {
      throw new MediaUploadError('NOT_AVAILABLE', "Uploads aren't available right now.");
    }
    let eventId: string;
    try {
      eventId = await this.repository.ensureEventId(templateId);
    } catch {
      throw new MediaUploadError('NETWORK_ERROR', "Couldn't reach the server — please try again.", true);
    }
    const ack = await this.media.uploadMedia(file, { ownerKind: 'USER', ownerId: eventId, mediaType });
    return ack.url ?? ack.storagePath;
  }
}
