// Writes sitemap.xml into the build output from the prerendered pages.
//
// Runs after `ng build` (npm postbuild). Rather than a hand-kept list that
// drifts from the routes, it walks every prerendered index.html and includes a
// page only if it is indexable (no "noindex" robots meta), canonical to itself,
// and not disallowed in robots.txt. A new prerendered page appears in the
// sitemap automatically; a noindex or duplicate page never does.

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SITE = 'https://theinvitely.in';
const OUT_DIR = 'dist/wedding-website/browser';

if (!existsSync(OUT_DIR)) {
  console.error(`generate-sitemap: ${OUT_DIR} not found — run the build first.`);
  process.exit(1);
}

/** Path prefixes from `Disallow:` lines (wildcard rules are skipped — they target files, not pages). */
const disallowed = readFileSync(join(OUT_DIR, 'robots.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.match(/^Disallow:\s*(\S+)/i)?.[1])
  .filter((rule) => rule && !rule.includes('*'));

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // Static template demos are not app pages.
      if (name === 'invitation-templates') continue;
      yield* htmlFiles(full);
    } else if (name === 'index.html') {
      yield full;
    }
  }
}

const attr = (html, re) => html.match(re)?.[1];

const urls = [];
for (const file of htmlFiles(OUT_DIR)) {
  const dir = relative(OUT_DIR, file).split(sep).slice(0, -1).join('/');
  const path = dir ? `/${dir}` : '/';
  const html = readFileSync(file, 'utf8');

  const robots = attr(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i) ?? '';
  const canonical = attr(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
  const expected = path === '/' ? SITE : `${SITE}${path}`;

  if (robots.includes('noindex')) continue;
  if (
    disallowed.some(
      (rule) => path === rule || path.startsWith(rule.endsWith('/') ? rule : `${rule}/`),
    )
  )
    continue;
  if (canonical !== expected) {
    console.warn(`generate-sitemap: skipping ${path} (canonical ${canonical ?? 'missing'})`);
    continue;
  }
  urls.push(expected);
}

urls.sort((a, b) => a.length - b.length || a.localeCompare(b));
const today = new Date().toISOString().slice(0, 10);
const priority = (url) => {
  const depth = url.replace(SITE, '').split('/').filter(Boolean).length;
  return depth === 0 ? '1.0' : depth === 1 ? '0.8' : '0.6';
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority(url)}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;

writeFileSync(join(OUT_DIR, 'sitemap.xml'), xml);
console.log(`generate-sitemap: wrote ${urls.length} URLs to ${OUT_DIR}/sitemap.xml`);
