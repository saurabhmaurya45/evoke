import { cardVersion, describeCard, loadInvitation, loadInvitationBySubdomain } from './_lib/invitation.mjs';
import { hasSignedMedia, withInvitationBootstrap, withInvitationData, withShareTags } from './_lib/page-tags.mjs';

const API_TIMEOUT_MS = 1500;
const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const NOINDEX = 'noindex, nofollow';

function htmlHeaders({ cache, status, varyHost }) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cache,
    'X-Robots-Tag': NOINDEX,
  };
  if (varyHost) headers.Vary = 'Host';
  return { status, headers };
}

/**
 * Serves /i/:slug and wedding subdomains (via middleware ?subdomain=).
 * WhatsApp and friends don't run JavaScript, so title/description/image are injected into HTML.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const slugParam = url.searchParams.get('slug') ?? '';
  const subdomainParam = url.searchParams.get('subdomain') ?? '';
  const forwardedHost = request.headers.get('x-forwarded-host') || url.host;
  const origin = forwardedHost.includes('://') ? forwardedHost : `https://${forwardedHost}`;

  const shellResponse = await fetch(new URL('/index.csr.html', url.origin));
  const shell = await shellResponse.text();
  const page = (html, { cache, status = shellResponse.status, varyHost = false }) =>
    new Response(html, htmlHeaders({ cache, status, varyHost }));

  const bySubdomain = Boolean(subdomainParam);
  const invitation = bySubdomain
    ? await loadInvitationBySubdomain(subdomainParam, API_TIMEOUT_MS)
    : await loadInvitation(slugParam, API_TIMEOUT_MS);

  if (!invitation) {
    const cache = bySubdomain ? 'public, max-age=0, must-revalidate' : 'public, max-age=0, must-revalidate';
    const status = bySubdomain ? 404 : shellResponse.status;
    return page(shell, { cache, status, varyHost: bySubdomain });
  }

  const slug = invitation.slug ?? slugParam;
  const card = describeCard(invitation);
  const publicSubdomain = invitation.publicSubdomain ?? invitation.public_subdomain ?? subdomainParam;
  // og:url is the address being shared: the subdomain only when the visit came through it.
  // A /i/{slug} link must not point WhatsApp/Facebook at a subdomain that may not resolve,
  // or the link preview can fail to show.
  const shareUrl = bySubdomain && publicSubdomain
    ? `https://${publicSubdomain}.${apexFromOrigin(origin)}/`
    : `${origin}/i/${slug}`;

  let html = withShareTags(shell, {
    title: card.title,
    description: card.description,
    url: shareUrl,
    image: `${origin}/api/invitation-card?slug=${encodeURIComponent(slug)}&v=${cardVersion(card)}`,
  });
  if (bySubdomain) {
    html = withInvitationBootstrap(html, slug);
  }
  if (!hasSignedMedia(invitation)) {
    html = withInvitationData(html, invitation);
  }

  return page(html, { cache: CACHE, varyHost: bySubdomain });
}

function apexFromOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    const parts = host.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : host;
  } catch {
    return 'theinvitely.in';
  }
}