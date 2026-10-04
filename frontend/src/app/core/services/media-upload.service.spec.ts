import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MediaUploadError, MediaUploadService } from './media-upload.service';

describe('MediaUploadService', () => {
  let service: MediaUploadService;
  let http: HttpTestingController;
  let fetchSpy: jasmine.Spy;

  const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
  const opts = { ownerKind: 'BASE', ownerId: 'tpl-1', mediaType: 'IMAGE', targetField: 'thumbnail' } as const;
  const presign = {
    uploadId: 'up-1',
    uploadUrl: 'https://s3.example.backblazeb2.com/bucket/key?sig=1',
    storagePath: 'asset/tpl-1/image/x.jpg',
    expiresAt: '2026-10-04T12:10:00Z',
    requiredHeaders: { 'Content-Type': 'image/jpeg' },
  };

  /** Let pending promise continuations run so the next request is issued. */
  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MediaUploadService);
    http = TestBed.inject(HttpTestingController);
    fetchSpy = spyOn(window, 'fetch');
  });

  afterEach(() => http.verify());

  it('requests, PUTs to storage with the required headers, then acks SUCCESS', async () => {
    fetchSpy.and.resolveTo(new Response(null, { status: 200 }));
    const result = service.uploadMedia(file, opts);

    const upload = http.expectOne('v1/media/upload');
    expect(upload.request.body).toEqual({
      ownerKind: 'BASE',
      ownerId: 'tpl-1',
      mediaType: 'IMAGE',
      contentType: 'image/jpeg',
      fileName: 'photo.jpg',
      fileSizeBytes: 1024,
    });
    upload.flush({ data: presign });
    await flushMicrotasks();

    expect(fetchSpy).toHaveBeenCalledWith(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.requiredHeaders,
      body: file,
    });

    const ack = http.expectOne('v1/media/upload/ack');
    expect(ack.request.body).toEqual({ uploadId: 'up-1', status: 'SUCCESS', targetField: 'thumbnail' });
    ack.flush({ data: { uploadId: 'up-1', status: 'UPLOADED', storagePath: presign.storagePath } });

    expect((await result).status).toBe('UPLOADED');
  });

  it('acks FAILURE when the storage PUT fails, and rejects', async () => {
    fetchSpy.and.resolveTo(new Response(null, { status: 403 }));
    const result = service.uploadMedia(file, opts);
    http.expectOne('v1/media/upload').flush({ data: presign });
    await flushMicrotasks();

    const ack = http.expectOne('v1/media/upload/ack');
    expect(ack.request.body.status).toBe('FAILURE');
    ack.flush({ data: { uploadId: 'up-1', status: 'FAILED', storagePath: presign.storagePath } });

    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ code: 'STORAGE_PUT_FAILED' }));
  });

  it('treats a 422 from the ack as a failed verification', async () => {
    fetchSpy.and.resolveTo(new Response(null, { status: 200 }));
    const result = service.uploadMedia(file, opts);
    http.expectOne('v1/media/upload').flush({ data: presign });
    await flushMicrotasks();
    http
      .expectOne('v1/media/upload/ack')
      .flush({ error: { code: 'VALIDATION_FAILED', message: 'x' } }, { status: 422, statusText: 'Unprocessable' });

    await expectAsync(result).toBeRejectedWith(
      jasmine.objectContaining({ code: 'UPLOAD_VERIFICATION_FAILED', retryable: true }),
    );
  });

  it('reports storage not configured distinctly', async () => {
    const result = service.uploadMedia(file, opts);
    http
      .expectOne('v1/media/upload')
      .flush(
        { error: { code: 'MEDIA_STORAGE_NOT_CONFIGURED', message: 'x' } },
        { status: 503, statusText: 'Unavailable' },
      );
    await expectAsync(result).toBeRejectedWith(
      jasmine.objectContaining({ code: 'MEDIA_STORAGE_NOT_CONFIGURED', message: "Uploads aren't available right now." }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects disallowed or oversized files before calling the API', async () => {
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    await expectAsync(service.uploadMedia(svg, opts)).toBeRejectedWithError(MediaUploadError);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'b.jpg', { type: 'image/jpeg' });
    await expectAsync(service.uploadMedia(big, opts)).toBeRejectedWithError(MediaUploadError, /5 MB/);
  });
});
