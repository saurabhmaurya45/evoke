import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MediaUploadError } from '../../../../core/services/media-upload.service';
import { EditorMediaService } from '../../data/editor-media.service';
import { ImageOptimizerService } from '../../data/image-optimizer.service';
import type { FieldSchema } from '../../models/template-schema.model';
import { FieldControlComponent } from './field-control.component';

describe('FieldControlComponent uploads', () => {
  let fixture: ComponentFixture<FieldControlComponent>;
  let emitted: unknown[];
  let media: jasmine.SpyObj<EditorMediaService>;

  // What the compressor hands back — the test checks this exact file is uploaded.
  const COMPRESSED = new File([new Uint8Array([1, 2, 3])], 'me.jpg', { type: 'image/jpeg' });
  const COMPRESSED_DATA_URL = 'data:image/jpeg;base64,AQID';

  function setup(field: Partial<FieldSchema>): void {
    media = jasmine.createSpyObj<EditorMediaService>('EditorMediaService', ['canUpload', 'upload']);
    TestBed.configureTestingModule({
      imports: [FieldControlComponent],
      providers: [
        { provide: EditorMediaService, useValue: media },
        // Skip real canvas work: the compressed image is a fixed file.
        { provide: ImageOptimizerService, useValue: { compress: () => Promise.resolve(COMPRESSED) } },
      ],
    });
    fixture = TestBed.createComponent(FieldControlComponent);
    fixture.componentRef.setInput('field', { key: 'photo', label: 'Photo', ...field } as FieldSchema);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  }

  async function pick(file: File): Promise<void> {
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const list = new DataTransfer();
    list.items.add(file);
    input.files = list.files;
    input.dispatchEvent(new Event('change'));
    // Let the async handler (optimize → decode → upload) finish: it's done once
    // something was emitted or an error is shown.
    const done = () =>
      emitted.length > 0 || !!fixture.nativeElement.querySelector('.field__error');
    for (let i = 0; i < 100 && !done(); i++) {
      await new Promise((r) => setTimeout(r, 10));
      fixture.detectChanges();
    }
  }

  const image = () => new File([new Uint8Array(10)], 'me.png', { type: 'image/png' });

  it('uploads an image to storage and emits its URL when signed in', async () => {
    setup({ type: 'image' });
    media.canUpload.and.returnValue(true);
    media.upload.and.resolveTo('https://s3.example/bucket/public/u/e/image/x.png?sig');

    await pick(image());

    // The compressed file itself — no base64 round trip on the way.
    expect(media.upload).toHaveBeenCalledWith(COMPRESSED, 'IMAGE');
    expect(emitted).toEqual(['https://s3.example/bucket/public/u/e/image/x.png?sig']);
  });

  it('keeps the image inline when signed out', async () => {
    setup({ type: 'image' });
    media.canUpload.and.returnValue(false);

    await pick(image());

    expect(media.upload).not.toHaveBeenCalled();
    expect(emitted).toEqual([COMPRESSED_DATA_URL]);
  });

  it('shows the error and leaves the value alone when the upload fails', async () => {
    setup({ type: 'image' });
    media.canUpload.and.returnValue(true);
    media.upload.and.rejectWith(
      new MediaUploadError('UPLOAD_VERIFICATION_FAILED', "The upload didn't complete — please try again."),
    );

    await pick(image());

    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.querySelector('.field__error')?.textContent).toContain(
      "The upload didn't complete",
    );
  });

  it('keeps the file inline when the server has no media storage configured', async () => {
    setup({ type: 'image' });
    media.canUpload.and.returnValue(true);
    media.upload.and.rejectWith(
      new MediaUploadError('MEDIA_STORAGE_NOT_CONFIGURED', "Uploads aren't available right now."),
    );

    await pick(image());

    expect(emitted).toEqual([COMPRESSED_DATA_URL]);
    expect(fixture.nativeElement.querySelector('.field__error')).toBeNull();
  });

  it('uploads music with a standard content type', async () => {
    setup({ type: 'audio' });
    media.canUpload.and.returnValue(true);
    media.upload.and.resolveTo('https://s3.example/bucket/public/u/e/music/x.m4a?sig');

    await pick(new File([new Uint8Array(10)], 'song.m4a', { type: 'audio/x-m4a' }));

    const [file, kind] = media.upload.calls.mostRecent().args;
    expect(kind).toBe('MUSIC');
    expect(file.type).toBe('audio/mp4');
    expect(emitted).toEqual(['https://s3.example/bucket/public/u/e/music/x.m4a?sig']);
  });
});
