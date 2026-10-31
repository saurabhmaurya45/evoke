#!/usr/bin/env node
/**
 * Checks a template's film without rendering a video, and checks a rendered video.
 *
 *   node check-film.mjs <template-id>              runs templates/<template-id>/checks.json
 *   node check-film.mjs --video <file.mp4>         reports length, repeated frames and stalls
 *
 * checks.json is a list of cases: { "name", "data", "want": [...], "reject": [...] }. Each film is swept
 * from start to end with that data as saved, and a case fails if a `want` text never shows, a `reject`
 * text does show, the page throws, an image is broken, a position is NaN, or text runs off the screen.
 * `data` may be "$sample", meaning the template's defaults.json.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(HERE, '../../frontend/public/invitation-templates');

function checkVideo(file) {
  if (!fs.existsSync(file)) throw new Error(`No such video: ${file}`);
  const log = spawnSync(ffmpegPath, ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=200:lo=100:frac=0.1,showinfo', '-f', 'null', '-'], { maxBuffer: 1e9 }).stderr.toString();
  const seconds = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  const times = [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  const stalls = [];
  times.forEach((t, i) => { if (i && t - times[i - 1] > 0.12) stalls.push(`${(t - times[i - 1]).toFixed(2)}s at ${times[i - 1].toFixed(2)}s`); });
  console.log(`Length ${seconds ? Number(seconds[1]) * 3600 + Number(seconds[2]) * 60 + Number(seconds[3]) : '?'}s, audio: ${/Audio:/.test(log) ? 'yes' : 'NO'}`);
  console.log(`${times.length} distinct frames. Stalls: ${stalls.length ? stalls.join(', ') : 'none'}`);
}

async function checkTemplate(templateId) {
  const dir = path.join(HERE, 'templates', templateId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const defaults = JSON.parse(fs.readFileSync(path.join(TEMPLATES_ROOT, meta.folder, 'defaults.json'), 'utf8'));
  const cases = JSON.parse(fs.readFileSync(path.join(dir, 'checks.json'), 'utf8'));
  const browser = await chromium.launch();
  let failed = 0;
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.addInitScript(([d, now]) => { window.__DATA = d; window.__NOW = now; }, [c.data === '$sample' ? defaults : c.data, Date.now()]);
    await page.goto(pathToFileURL(path.join(dir, 'film.html')).href);
    const seconds = await page.evaluate(() => window.__ready);
    const r = await page.evaluate((length) => {
      const seen = new Set(), wide = new Set();
      let badNumbers = 0;
      const visible = (e) => {
        for (let x = e; x && x !== document.body; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false;
        return true;
      };
      for (let t = 0; t < length; t += 0.05) {
        window.__render(t);
        document.querySelectorAll('.a,.t').forEach((e) => { if (/NaN|Infinity/.test(e.style.transform + e.style.opacity)) badNumbers++; });
        document.querySelectorAll('.t').forEach((e) => {
          if (!visible(e) || Number(getComputedStyle(e).opacity) < 0.9) return;
          const s = e.textContent.replace(/ /g, ' ');
          seen.add(s);
          if (e.offsetWidth > 1000) wide.add(s);
        });
      }
      return { seen: [...seen], wide: [...wide], badNumbers, broken: [...document.images].filter((i) => !i.naturalWidth).length };
    }, seconds);
    const all = r.seen.join(' | ');
    const problems = [
      ...(c.want ?? []).filter((w) => !all.includes(w)).map((w) => `missing "${w}"`),
      ...(c.reject ?? []).filter((w) => all.includes(w)).map((w) => `should not show "${w}"`),
      ...errors.map((e) => `page error: ${e}`),
      ...r.wide.map((w) => `runs off screen: "${w}"`),
      ...(r.broken ? [`${r.broken} broken image(s)`] : []),
      ...(r.badNumbers ? [`${r.badNumbers} NaN positions`] : []),
    ];
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${c.name} (${seconds}s)`);
    problems.forEach((p) => console.log(`      ${p}`));
    await page.close();
  }
  await browser.close();
  console.log(failed ? `${failed} of ${cases.length} failed` : `All ${cases.length} passed`);
  if (failed) process.exitCode = 1;
}

const [first, second] = process.argv.slice(2);
try {
  if (first === '--video') checkVideo(second);
  else if (first) await checkTemplate(first);
  else throw new Error('Usage: node check-film.mjs <template-id> | --video <file.mp4>');
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
}
