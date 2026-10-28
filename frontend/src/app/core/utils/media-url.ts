import { environment } from '../../../environments/environment';

/**
 * Absolute URL of a template media file (video, audio, image) given its site path,
 * e.g. `/invitation-templates/template%204/card.mp4`.
 *
 * In production the heavy media lives in a public bucket (`environment.mediaBaseUrl`)
 * under the same key, so the path maps 1:1; locally the base is empty and the file
 * is served from `public/` as before. Media referenced from *inside* a template page
 * (relative paths) is redirected to the bucket by vercel.json instead.
 */
export function mediaUrl(path: string): string {
  return `${environment.mediaBaseUrl}${path}`;
}
