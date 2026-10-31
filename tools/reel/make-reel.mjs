#!/usr/bin/env node
/**
 * Turns one filled-in invitation into an Instagram reel (1080x1920, 30fps, H.264 + AAC).
 *
 *   node make-reel.mjs <template-id> [--data my.json | --slug <invitation-slug>] [options]
 *
 *   --data <file>        the filled-in template data (same JSON shape as the editor saves)
 *   --slug <slug>        or fetch it from a PUBLISHED invitation (GET /v1/i/<slug>)
 *   --api <url>          API base for --slug (default: production)
 *   --out <file>         output path (default: out/<template>-<slug|data file|sample>.mp4)
 *   --song <file|url>    use this song instead of the invitation's own music
 *   --bpm <n>            song tempo; detected automatically if left out
 *   --song-start <sec>   where in the song to start; detected automatically if left out
 *   --stills <t1,t2,..>  skip the video, write JPEGs at these film times next to --out (for checking)
 *
 * The data is used exactly as saved: a section with nothing in it is left out of the video, and sample
 * text the user saved is shown like any other text. With neither --data nor --slug it renders the
 * template's sample content. Each template's film
 * lives in templates/<template-id>/ (film.html + meta.json), because every design animates differently.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';
import { findBeat, SAMPLE_RATE } from './lib/song.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(HERE, '../../frontend/public/invitation-templates');
const FPS = 30;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { template: null };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) {
      if (opts.template) fail(`Unexpected argument "${argv[i]}".`);
      opts.template = argv[i];
      continue;
    }
    const key = argv[i].slice(2);
    if (!['data', 'slug', 'api', 'out', 'song', 'bpm', 'song-start', 'stills'].includes(key)) fail(`Unknown option --${key}.`);
    if (argv[i + 1] === undefined) fail(`--${key} needs a value.`);
    opts[key] = argv[++i];
  }
  return opts;
}

function availableTemplates() {
  return fs.readdirSync(path.join(HERE, 'templates')).filter((d) => fs.existsSync(path.join(HERE, 'templates', d, 'film.html')));
}

async function loadUserData(opts, templateId) {
  if (opts.data && opts.slug) fail('Use either --data or --slug, not both.');
  if (opts.data) {
    try {
      return JSON.parse(fs.readFileSync(opts.data, 'utf8'));
    } catch (e) {
      fail(`Could not read --data ${opts.data}: ${e.message}`);
    }
  }
  if (!opts.slug) return {};
  const api = (opts.api || 'https://evokebackend.vercel.app').replace(/\/$/, '');
  const res = await fetch(`${api}/v1/i/${encodeURIComponent(opts.slug)}`).catch((e) => fail(`Could not reach ${api}: ${e.cause?.code ?? e.message}`));
  if (!res.ok) fail(`Could not load invitation "${opts.slug}" (HTTP ${res.status}). Only published invitations work with --slug.`);
  const invitation = await res.json().catch(() => fail(`${api} did not return valid JSON for invitation "${opts.slug}".`));
  if (invitation.templateSlotId !== templateId) {
    fail(`Invitation "${opts.slug}" uses ${invitation.templateSlotId}, not ${templateId}.`);
  }
  return invitation.draftData ?? {};
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((cur, key) => cur?.[key], obj);
}

function run(args, { stdin = false, capture = false } = {}) {
  const child = spawn(ffmpegPath, args, { stdio: [stdin ? 'pipe' : 'ignore', capture ? 'pipe' : 'ignore', 'pipe'] });
  const chunks = [];
  let stderr = '';
  if (capture) child.stdout.on('data', (c) => chunks.push(c));
  child.stderr.on('data', (c) => { stderr += c; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr.slice(-800)))));
  });
  return { child, done };
}

async function analyseSong(song, filmSeconds, targetBpm) {
  const pcm = await run(['-loglevel', 'error', '-i', song, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-'], { capture: true }).done;
  const copy = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 4));
  return findBeat(new Float32Array(copy), filmSeconds, targetBpm);
}

function isDefaultSong(url, sample) {
  return !url || url === sample;
}

async function resolveSong(opts, meta, data, defaults, filmSeconds) {
  const fromData = data.music?.track;
  const usable = typeof fromData === 'string' && /^https?:\/\//i.test(fromData);
  const song = opts.song || (usable && !isDefaultSong(fromData, defaults.music?.track) ? fromData : meta.song.url);
  if (opts.song && !/^https?:\/\//i.test(opts.song) && !fs.existsSync(opts.song)) fail(`Song file not found: ${opts.song}`);

  let { bpm, firstBeat } = song === meta.song.url ? meta.song : {};
  if (opts.bpm) {
    bpm = Number(opts.bpm);
    if (!(bpm >= 40 && bpm <= 220)) fail('--bpm must be a number between 40 and 220.');
  }
  if (opts['song-start']) {
    firstBeat = Number(opts['song-start']);
    if (!(firstBeat >= 0)) fail('--song-start must be a number of seconds.');
  }
  if (bpm === undefined || firstBeat === undefined) {
    console.log('Analysing the song for its beat...');
    const found = await analyseSong(song, filmSeconds, meta.bpm);
    bpm ??= found.bpm;
    firstBeat ??= found.firstBeat;
    console.log(`  ${bpm.toFixed(1)} BPM, starting from ${firstBeat.toFixed(2)}s`);
  }
  return { song, bpm, firstBeat };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const templates = availableTemplates();
  if (!opts.template) fail(`Choose a template: ${templates.join(', ')}`);
  if (!templates.includes(opts.template)) fail(`No reel script for "${opts.template}" yet. Available: ${templates.join(', ')}`);

  const dir = path.join(HERE, 'templates', opts.template);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const defaults = JSON.parse(fs.readFileSync(path.join(TEMPLATES_ROOT, meta.folder, 'defaults.json'), 'utf8'));
  const userData = await loadUserData(opts, opts.template);
  if (!userData || typeof userData !== 'object' || Array.isArray(userData)) fail('The invitation data must be a JSON object.');
  const data = opts.data || opts.slug ? userData : defaults;
  const missing = (meta.required ?? []).filter((p) => !String(getPath(data, p) ?? '').trim());
  if (missing.length) fail(`These details are required but empty: ${missing.join(', ')}.`);

  const label = opts.slug || (opts.data ? path.basename(opts.data, path.extname(opts.data)) : 'sample');
  const out = path.resolve(opts.out || path.join(HERE, 'out', `${opts.template}-${label}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'warning') console.warn(`  ${m.text()}`); });
    await page.addInitScript(([d, now]) => { window.__DATA = d; window.__NOW = now; }, [data, Date.now()]);
    await page.goto(pathToFileURL(path.join(dir, 'film.html')).href);
    const filmSeconds = await page.evaluate(() => window.__ready);
    if (pageErrors.length) throw new Error(`The film failed to load: ${pageErrors[0]}`);
    // A film that leaves out its opening reaches its first strong beat sooner.
    const firstBar = (await page.evaluate(() => window.__firstBar)) ?? meta.firstBar;

    const shoot = async (filmTime) => {
      await page.evaluate((v) => new Promise((resolve) => {
        window.__render(v);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }), filmTime);
      return page.screenshot({ type: 'jpeg', quality: 95 });
    };

    if (opts.stills) {
      const base = out.replace(/\.mp4$/i, '');
      for (const t of opts.stills.split(',').map(Number)) {
        if (!Number.isFinite(t)) fail('--stills takes comma-separated seconds, like 3,8.5,12.');
        fs.writeFileSync(`${base}-${String(t.toFixed(2)).padStart(6, '0')}.jpg`, await shoot(t));
      }
      console.log(`Stills written next to ${base}`);
      return;
    }

    const { song, bpm, firstBeat } = await resolveSong(opts, meta, data, defaults, filmSeconds);
    // The film is choreographed at meta.bpm; playing it faster or slower puts its cuts on this song's beat.
    const speed = bpm / meta.bpm;
    const seconds = filmSeconds / speed;
    const frames = Math.ceil(seconds * FPS);
    const songStart = Math.max(0, firstBeat - firstBar / speed);

    const { child, done } = run([
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      // A song shorter than the film loops instead of leaving the end silent.
      '-stream_loop', '-1', '-ss', songStart.toFixed(3), '-t', seconds.toFixed(3), '-i', song,
      '-filter_complex',
      `[0:v]scale=in_range=pc:out_range=tv,format=yuv420p[v];[1:a]afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, seconds - 2).toFixed(3)}:d=2[a]`,
      '-map', '[v]', '-map', '[a]', '-t', seconds.toFixed(3),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '16M', '-bufsize', '32M', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
    ], { stdin: true });
    child.stdin.on('error', () => {}); // a dead ffmpeg is reported through `done`
    let ffmpegFailed = null;
    done.catch((e) => { ffmpegFailed = e; });

    console.log(`Rendering ${frames} frames...`);
    for (let i = 0; i < frames; i++) {
      if (ffmpegFailed) break;
      const jpeg = await shoot((i / FPS) * speed);
      if (!child.stdin.write(jpeg)) await Promise.race([new Promise((resolve) => child.stdin.once('drain', resolve)), done.catch(() => {})]);
      if (i % 150 === 0) console.log(`  ${Math.round((i / frames) * 100)}%`);
    }
    child.stdin.end();
    await done.catch((e) => { throw new Error(`Could not make the video (is the song reachable and the output path writable?): ${e.message.trim().split('\n').pop()}`); });
    if (pageErrors.length) throw new Error(`The film hit an error while rendering: ${pageErrors[0]}`);
    console.log(`Done: ${out} (${seconds.toFixed(1)}s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => fail(e.message));
