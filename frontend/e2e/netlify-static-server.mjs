// Serves the build the way Netlify does (see netlify.toml), so e2e tests see
// exactly what crawlers see in production:
//   - a prerendered `<path>/index.html` or static file if one exists,
//   - `/services` → 301 `/wedding-invitations`,
//   - otherwise the client shell `/index.csr.html` (status 200),
//   - `X-Robots-Tag` on /i/*, /preview/*, /editor/*.
// Rules are parsed from netlify.toml so the two can't drift.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist/wedding-website/browser';
const PORT = Number(process.env.PORT ?? 4321);
const toml = readFileSync('netlify.toml', 'utf8');

const redirects = [
  ...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)/g),
]
  .map(([, from, to, status]) => ({ from, to, status: Number(status) }))
  .filter((r) => r.status === 301);
const headerRules = [
  ...toml.matchAll(
    /\[\[headers\]\]\s+for = "([^"]+)"\s+\[headers\.values\]\s+([\s\S]*?)(?=\n\s*\n|\n#|$)/g,
  ),
].map(([, pattern, body]) => ({
  re: new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`),
  headers: Object.fromEntries(
    [...body.matchAll(/([\w-]+) = "([^"]*)"/g)].map(([, k, v]) => [k, v]),
  ),
}));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.gif': 'image/gif',
};

const isFile = (p) => existsSync(p) && statSync(p).isFile();

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const rule of headerRules)
    if (rule.re.test(path)) for (const [k, v] of Object.entries(rule.headers)) res.setHeader(k, v);

  const redirect = redirects.find((r) => r.from === path);
  if (redirect) {
    res.writeHead(redirect.status, { Location: redirect.to }).end();
    return;
  }

  const safe = normalize(path).replace(/^([/\\])+/, '');
  const candidates = [join(ROOT, safe), join(ROOT, safe, 'index.html')];
  const file = candidates.find(isFile) ?? join(ROOT, 'index.csr.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`netlify-static-server on http://localhost:${PORT}`));
