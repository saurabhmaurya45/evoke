import { createHash } from 'node:crypto';
import { customShareImage, posterPath, sharePhotos, shareText } from './share-meta.mjs';

const API_URL = (process.env.INVITATION_API_URL || 'https://evokebackend.vercel.app').replace(/\/$/, '');
export const MEDIA_BASE_URL = 'https://pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev/asset';
const MEDIA_HOSTS = (process.env.SHARE_MEDIA_HOSTS || 'pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug);
}

/** The published invitation, or null if it isn't public or the API can't answer within `timeoutMs`. */
export async function loadInvitation(slug, timeoutMs) {
  if (!isValidSlug(slug)) return null;
  try {
    const response = await fetch(`${API_URL}/v1/i/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const invitation = await response.json();
    return invitation?.status === 'PUBLISHED' ? invitation : null;
  } catch {
    return null;
  }
}

/**
 * Only files uploaded for this very invitation may appear on its card. That keeps out the template's
 * sample photos (other couples' faces), and because the function fetches these URLs itself, it also
 * means a URL pasted into a field can't point it at anything else.
 */
export function isOwnUpload(url, eventId) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    return protocol === 'https:' && MEDIA_HOSTS.includes(hostname) && decodeURIComponent(pathname).includes(`/${eventId}/image/`);
  } catch {
    return false;
  }
}

/** What goes on the card. `custom` means the user picked the picture, so it is shown without any text on it. */
export function describeCard(invitation) {
  const templateId = invitation.templateSlotId;
  const data = invitation.draftData ?? {};
  const own = (url) => isOwnUpload(url, invitation.eventId);
  const custom = customShareImage(data);
  const useCustom = own(custom);
  const photo = useCustom ? custom : sharePhotos(templateId, data).find(own);
  const poster = posterPath(templateId);
  return {
    ...shareText(templateId, data),
    custom: useCustom,
    image: photo || (poster ? `${MEDIA_BASE_URL}${poster}` : ''),
  };
}

/** Changes whenever the card would look different, so WhatsApp and the CDN fetch a new one. */
export function cardVersion(card) {
  // A signed URL differs on every read; only its path says which file it is.
  const image = card.image.split('?')[0];
  return createHash('sha1')
    .update(JSON.stringify([card.names, card.date, card.custom, image]))
    .digest('hex')
    .slice(0, 12);
}
