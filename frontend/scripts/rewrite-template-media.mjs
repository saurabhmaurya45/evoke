// Point every media reference inside the invitation templates at the public media bucket.
//
// The templates are plain pages under public/invitation-templates/template N/ whose
// videos, audio and images are uploaded to the bucket (backend/scripts/upload_template_media.py)
// under the same relative path with an `asset/` prefix. This rewrites references to those files
// — relative ("static/media/a.mp3", "../static/x.png" in CSS) or site-absolute
// ("/invitation-templates/template%2010/static/…") — into absolute bucket URLs.
//
// Idempotent, and re-pointable: running it again with another base (say a custom domain)
// replaces the previous bucket URLs.
//
//   node scripts/rewrite-template-media.mjs <mediaBaseUrl>          # dry run
//   node scripts/rewrite-template-media.mjs <mediaBaseUrl> --apply  # write files
//
//   <mediaBaseUrl> is environment.mediaBaseUrl, e.g. https://pub-xxxx.r2.dev/asset
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--'))?.replace(/\/+$/, '');
const apply = args.includes('--apply');
if (!base || !/^https:\/\//.test(base)) {
  console.error('usage: node scripts/rewrite-template-media.mjs https://<media-host>/asset [--apply]');
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'invitation-templates');
const MEDIA = /\.(?:mp4|webm|mp3|m4a|jpe?g|png|webp|gif)$/i;
const TEXT = /\.(?:html|js|mjs|css|json)$/i;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const toPosix = (p) => p.split(sep).join('/');
// "template 10" -> "template%2010"; each path segment encoded, slashes kept.
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

let totalChanged = 0;
const templates = readdirSync(ROOT).filter((n) => /^template \d+$/.test(n));

for (const tpl of templates) {
  const tplDir = join(ROOT, tpl);
  const all = walk(tplDir);
  const media = new Set(all.filter((f) => MEDIA.test(f)).map((f) => toPosix(relative(tplDir, f))));
  const urlFor = (relPath) => `${base}/invitation-templates/${enc(tpl)}/${enc(relPath)}`;

  for (const file of all.filter((f) => TEXT.test(f))) {
    const original = readFileSync(file, 'utf8');
    // Relative references resolve against the page for html/js/json, against the stylesheet for css.
    const refDir = /\.css$/i.test(file) ? toPosix(relative(tplDir, dirname(file))) : '';
    let count = 0;

    let out = original
      // 1) a previous bucket URL for this template -> the current base
      .replace(
        /https:\/\/[^"'`()\s]+?\/asset\/invitation-templates\/(template%20\d+)\/([^"'`()\s?#]+)/g,
        (m, t, p) => {
          const next = `${base}/invitation-templates/${t}/${p}`;
          if (next !== m) count++;
          return next;
        },
      )
      // 2) site-absolute path -> bucket
      .replace(
        /(?<![A-Za-z0-9:.])\/invitation-templates\/(template(?:%20| )\d+)\/([^"'`()\s?#,;]+?\.(?:mp4|webm|mp3|m4a|jpe?g|png|webp|gif))/gi,
        (m, t, p) => {
          const dir = decodeURIComponent(t);
          if (!media.has(decodeURIComponent(p)) || dir !== tpl) return m;
          count++;
          return urlFor(decodeURIComponent(p));
        },
      )
      // 3) relative reference that resolves to a real media file of this template
      .replace(
        /(?<=["'`(=,\s])((?:\.{1,2}\/)*)([A-Za-z0-9_@~%+ -][^"'`()\s<>?#,;]*?\.(?:mp4|webm|mp3|m4a|jpe?g|png|webp|gif))(?=["'`)?#,;\s])/gi,
        (m, dots, p) => {
          if (/^[a-z][a-z0-9+.-]*:/i.test(m)) return m; // https:, data:, blob: ...
          let decoded;
          try {
            decoded = decodeURIComponent(dots + p);
          } catch {
            return m;
          }
          const resolved = posix.normalize(posix.join(refDir, decoded));
          if (resolved.startsWith('..') || !media.has(resolved)) return m;
          count++;
          return urlFor(resolved);
        },
      );

    if (out !== original) {
      totalChanged++;
      console.log(`${apply ? 'rewrote' : 'would rewrite'} ${toPosix(relative(ROOT, file))}  (${count} refs)`);
      if (apply) writeFileSync(file, out);
    }
  }
}
console.log(`${totalChanged} files ${apply ? 'rewritten' : 'would change'} across ${templates.length} templates`);
