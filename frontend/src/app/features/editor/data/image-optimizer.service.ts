import { Injectable, inject } from '@angular/core';
import { WINDOW } from '../../../core/tokens/window.token';

/** Target ceiling for an optimized image (bytes). */
const MAX_BYTES = 1024 * 1024; // 1 MB
/** Never upscale; cap the longest side so huge camera photos shrink first. */
const MAX_DIMENSION = 2000;
/** Starting (near-lossless) JPEG quality; lowered only if still over budget. */
const START_QUALITY = 0.92;
const MIN_QUALITY = 0.6;
const MIN_DIMENSION = 480;

/**
 * Compresses an uploaded image to fit under {@link MAX_BYTES} while keeping
 * quality as high as possible: it re-encodes at high quality first and only
 * steps quality/scale down when the result is still too large.
 *
 * Returns a file — uploaded to media storage as-is, or read as a data URL only
 * when the image is kept inline in the draft (signed-out editing).
 *
 * Browser-only (needs canvas). Non-raster or animated types (SVG/GIF) and
 * already-small files are passed through untouched.
 */
@Injectable({ providedIn: 'root' })
export class ImageOptimizerService {
  private readonly window = inject(WINDOW);

  /** The compressed image as a file — the original when it needs no work. */
  async compress(file: File): Promise<File> {
    const canCanvas = !!this.window && typeof this.window.document !== 'undefined';
    const raster = /^image\/(jpe?g|png|webp|bmp)$/i.test(file.type);

    // Pass through when we can't/shouldn't rasterize, or it's already small.
    if (!canCanvas || !raster || (file.size <= MAX_BYTES && file.type !== 'image/bmp')) {
      return file;
    }

    let bitmap: HTMLImageElement;
    try {
      bitmap = await this.loadImage(file);
    } catch {
      return file;
    }

    const start = this.fit(bitmap.naturalWidth, bitmap.naturalHeight, MAX_DIMENSION);
    let width = start.width;
    let height = start.height;
    let quality = START_QUALITY;
    let blob = await this.encode(bitmap, width, height, quality);
    if (!blob) return file;

    // Shrink quality first (cheap, near-lossless), then dimensions, until it fits.
    while (blob.size > MAX_BYTES) {
      if (quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.08);
      } else if (Math.min(width, height) > MIN_DIMENSION) {
        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
        quality = 0.85;
      } else {
        break; // Smallest acceptable render — accept whatever we have.
      }
      blob = (await this.encode(bitmap, width, height, quality)) ?? blob;
    }

    const name = (file.name.replace(/\.[^.]+$/, '') || 'image') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }

  private fit(w: number, h: number, max: number): { width: number; height: number } {
    if (w <= max && h <= max) {
      return { width: w, height: h };
    }
    const scale = max / Math.max(w, h);
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  private encode(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null> {
    const canvas = this.window!.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Promise.resolve(null);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
}
