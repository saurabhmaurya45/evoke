const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function setMeta(html, attribute, key, value) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  const existing = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, 'i');
  // A function replacement: `$` in a user's text must stay literal.
  return existing.test(html) ? html.replace(existing, () => tag) : html.replace('</head>', () => `${tag}\n</head>`);
}

/** The app's page shell with its general link preview replaced by this invitation's. */
export function withShareTags(shell, { title, description, url, image }) {
  let html = shell.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
  const tags = [
    ['name', 'description', description],
    ['property', 'og:type', 'website'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', image],
    ['property', 'og:image:secure_url', image],
    ['property', 'og:image:type', 'image/jpeg'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', title],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', title],
  ];
  for (const [attribute, key, value] of tags) html = setMeta(html, attribute, key, value);
  return html;
}

/** JSON that can sit inside a <script>: user text can't close the tag or end the line early. */
function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * True when the invitation's media links are signed and expire (a private bucket). A cached page must
 * not carry those, so the browser then fetches the invitation itself as before.
 */
export function hasSignedMedia(invitation) {
  return /X-Amz-(Signature|Credential)/.test(JSON.stringify(invitation?.draftData ?? {}));
}

/**
 * The invitation itself in the page, so the app can show it at once instead of first waiting on the
 * backend, which may have to start up. The app still checks the backend afterwards for newer edits.
 */
export function withInvitationData(shell, invitation) {
  const tag = `<script>window.__TI_INVITATION__=${scriptJson(invitation)}</script>`;
  return shell.replace('</head>', () => `${tag}\n</head>`);
}

/** Slug for the Angular invitation viewer when the browser is on a wedding subdomain (`/`). */
export function withInvitationBootstrap(shell, slug) {
  const safe = JSON.stringify(slug);
  const tag = `<script>window.__TI_INVITATION_SLUG__=${safe}</script>`;
  const existing = /<script>window\.__TI_INVITATION_SLUG__=[^<]*<\/script>/i;
  return existing.test(shell)
    ? shell.replace(existing, () => tag)
    : shell.replace('</head>', () => `${tag}\n</head>`);
}
