import { environment } from '../../../environments/environment';

/** Apex host for couple subdomains, e.g. `theinvitely.in` from `https://theinvitely.in`. */
export function invitationApexHost(): string {
  return new URL(environment.appUrl).hostname;
}

const RESERVED_WEDDING_LABELS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'assets',
  'backend',
  'blog',
  'cdn',
  'dashboard',
  'dev',
  'editor',
  'evoke',
  'ftp',
  'mail',
  'media',
  'preview',
  'staging',
  'static',
  'test',
  'vercel',
]);

/** The hostname's wedding label when on `*.theinvitely.in`, else null (apex / localhost). */
export function weddingHostLabel(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const apex = invitationApexHost();
  if (host === apex || host === `www.${apex}`) return null;
  if (!host.endsWith(`.${apex}`)) return null;
  const label = host.slice(0, -(apex.length + 1));
  if (!label || RESERVED_WEDDING_LABELS.has(label)) return null;
  return label;
}

/** Prefer `https://couple.apex` when assigned; otherwise the legacy `/i/{slug}` link. */
export function invitationPublicUrl(event: {
  slug: string;
  publicSubdomain?: string | null;
}): string {
  const apex = invitationApexHost();
  if (event.publicSubdomain) {
    return `https://${event.publicSubdomain}.${apex}`;
  }
  return `${environment.appUrl}/i/${event.slug}`;
}