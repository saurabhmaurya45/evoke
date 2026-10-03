// Serves the build the way Vercel does in production, applying vercel.json,
// so e2e tests see exactly what crawlers see:
//   1. `redirects`,
//   2. a file on disk (a prerendered `<path>/index.html` or a static asset),
//   3. `rewrites` (the client-shell fallback),
//   4. otherwise 404,
// with matching `headers` added to every response. Rules are read from
// vercel.json so the two can't drift.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist/wedding-website/browser';
const PORT = Number(process.env.PORT ?? 4321);
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

/** Vercel `source` (path-to-regexp) → RegExp, covering the forms vercel.json uses. */
function toRegExp(source) {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch !== ':') {
      out += /[.+?^${}|[\]\\]/.test(ch) ? `\\${ch}` : ch;
      continue;
    }
    const name = /^\w+/.exec(source.slice(i + 1))[0];
    i += name.length;
    if (source[i + 1] === '(') {
      // Custom pattern: copy up to the matching parenthesis.
      let depth = 0;
      let j = i + 1;
      for (; j < source.length; j++) {
        if (source[j] === '\\') j++;
        else if (source[j] === '(') depth++;
        else if (source[j] === ')' && --depth === 0) break;
      }
      out += source.slice(i + 1, j + 1);
      i = j;
    } else if (source[i + 1] === '*') {
      out += '(.*)';
      i++;
    } else {
      out += '([^/]+)';
    }
  }
  return new RegExp(`^${out}$`);
}

const redirects = (config.redirects ?? []).map((r) => ({ ...r, re: toRegExp(r.source) }));
const rewrites = (config.rewrites ?? []).map((r) => ({ ...r, re: toRegExp(r.source) }));
const headerRules = (config.headers ?? []).map((r) => ({ ...r, re: toRegExp(r.source) }));

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
const onDisk = (path) => {
  const safe = normalize(path).replace(/^([/\\])+/, '');
  return [join(ROOT, safe), join(ROOT, safe, 'index.html')].find(isFile);
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const rule of headerRules) {
    if (rule.re.test(path)) for (const { key, value } of rule.headers) res.setHeader(key, value);
  }

  const redirect = redirects.find((r) => r.re.test(path));
  if (redirect) {
    res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination }).end();
    return;
  }

  let file = onDisk(path);
  if (!file) {
    const rewrite = rewrites.find((r) => r.re.test(path));
    if (rewrite) file = onDisk(rewrite.destination);
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`vercel-static-server on http://localhost:${PORT}`));
