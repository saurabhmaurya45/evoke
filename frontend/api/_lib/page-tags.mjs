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
