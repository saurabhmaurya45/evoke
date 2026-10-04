import { TestBed } from '@angular/core/testing';
import { ImageOptimizerService } from './image-optimizer.service';

describe('ImageOptimizerService', () => {
  let service: ImageOptimizerService;

  beforeEach(() => {
    service = TestBed.inject(ImageOptimizerService);
  });

  /** A PNG of random noise — doesn't compress, so it's well over 1 MB. */
  async function noisyPng(size: number): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i++) pixels.data[i] = (Math.random() * 256) | 0;
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    return new File([blob], 'photo.png', { type: 'image/png' });
  }

  it('compresses a large image to a JPEG file under 1 MB', async () => {
    const original = await noisyPng(1200);
    expect(original.size).toBeGreaterThan(1024 * 1024);

    const compressed = await service.compress(original);

    expect(compressed instanceof File).toBeTrue();
    expect(compressed.type).toBe('image/jpeg');
    expect(compressed.name).toBe('photo.jpg');
    expect(compressed.size).toBeLessThanOrEqual(1024 * 1024);
  });

  it('passes small images through untouched', async () => {
    const small = new File([new Uint8Array(100)], 'tiny.png', { type: 'image/png' });
    expect(await service.compress(small)).toBe(small);
  });
});
