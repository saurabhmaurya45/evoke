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
 * steps quality/scale down when the result is still too large. Used by every
 * image upload so drafts stay small (localStorage / payload friendly).
 *
 * Browser-only (needs canvas). Non-raster or animated types (SVG/GIF) and
 * already-small files are passed through untouched.
 */
@Injectable({ providedIn: 'root' })
export class ImageOptimizerService {
  private readonly window = inject(WINDOW);

  async optimize(file: File): Promise<string> {
    const canCanvas = !!this.window && typeof this.window.document !== 'undefined';
    const raster = /^image\/(jpe?g|png|webp|bmp)$/i.test(file.type);

    // Pass through when we can't/shouldn't rasterize, or it's already small.
    if (!canCanvas || !raster || (file.size <= MAX_BYTES && file.type !== 'image/bmp')) {
      return this.readAsDataUrl(file);
    }

    let bitmap: HTMLImageElement;
    try {
      bitmap = await this.loadImage(file);
    } catch {
      return this.readAsDataUrl(file);
    }

    const start = this.fit(bitmap.naturalWidth, bitmap.naturalHeight, MAX_DIMENSION);
    let width = start.width;
    let height = start.height;
    let quality = START_QUALITY;
    let dataUrl = this.encode(bitmap, width, height, quality);

    // Shrink quality first (cheap, near-lossless), then dimensions, until it fits.
    while (this.byteLength(dataUrl) > MAX_BYTES) {
      if (quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.08);
      } else if (Math.min(width, height) > MIN_DIMENSION) {
        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
        quality = 0.85;
      } else {
        break; // Smallest acceptable render — accept whatever we have.
      }
      dataUrl = this.encode(bitmap, width, height, quality);
    }

    return dataUrl;
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

  private encode(img: HTMLImageElement, width: number, height: number, quality: number): string {
    const canvas = this.window!.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return img.src;
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /** Approximate byte size of a base64 data URL without decoding it. */
  private byteLength(dataUrl: string): number {
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read'));
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
  }
}
