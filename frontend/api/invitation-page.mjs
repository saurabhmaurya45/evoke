import { cardVersion, describeCard, loadInvitation } from './_lib/invitation.mjs';
import { withShareTags } from './_lib/page-tags.mjs';

// Link-preview crawlers give up quickly, and guests are waiting: past this, serve the plain page.
const API_TIMEOUT_MS = 1500;
const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

/**
 * Serves /i/:slug. WhatsApp and friends don't run JavaScript, so an invitation's title, description and
 * image have to be in the HTML itself. The page is otherwise the normal app shell, and whatever goes
 * wrong here it still is: an invitation must always open.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';
  const shellResponse = await fetch(new URL('/index.csr.html', url.origin));
  const shell = await shellResponse.text();
  const page = (html, cache) =>
    new Response(html, { status: shellResponse.status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });

  const invitation = await loadInvitation(slug, API_TIMEOUT_MS);
  // Not cached: a slow API or a just-published invitation shouldn't stick for minutes.
  if (!invitation) return page(shell, 'public, max-age=0, must-revalidate');

  const card = describeCard(invitation);
  const origin = `https://${request.headers.get('x-forwarded-host') || url.host}`;
  return page(
    withShareTags(shell, {
      title: card.title,
      description: card.description,
      url: `${origin}/i/${slug}`,
      image: `${origin}/api/invitation-card?slug=${encodeURIComponent(slug)}&v=${cardVersion(card)}`,
    }),
    CACHE,
  );
}
