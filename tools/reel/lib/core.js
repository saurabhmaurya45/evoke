// Small toolkit shared by every template's film. Each film is a pure function of time: render(t)
// sets everything on screen for that moment, so frames can be captured one by one and none is dropped.
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => cl((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const outC = (p) => 1 - Math.pow(1 - p, 3);
const outE = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const inC = (p) => p * p * p;
const ioC = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const outB = (p, k = 1.70158) => 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2);
const inR = (t, a, b) => t >= a && t < b;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// User-supplied image URLs: only http(s) or an embedded image.
function safeImage(v) {
  if (typeof v !== 'string') return '';
  const u = v.trim();
  return /^https?:\/\//i.test(u) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(u) ? u : '';
}

// Text from user data: anything that is not a string or number shows as nothing.
const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const graphemes = (s) => [...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);

function mk(parent, tag, css) {
  const e = document.createElement(tag);
  e.className = 'a';
  if (css) e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

function im(parent, url, w, h, extra = '', fallback = '') {
  const e = mk(parent, 'img', `width:${w}px;${h ? `height:${h}px;` : ''}${extra}`);
  e.decoding = 'sync';
  e.src = url;
  if (fallback && fallback !== url) e.dataset.fallback = fallback;
  return e;
}

function scene(stage) {
  const e = document.createElement('div');
  e.className = 'sc';
  stage.appendChild(e);
  return e;
}

function show(el, t, a, b) {
  const on = t >= a && t < b;
  el.style.display = on ? 'block' : 'none';
  return on;
}

// Places an element by its centre.
function P(el, o = {}) {
  const { x = 540, y = 960, s = 1, r = 0, a = 1, b = 0, ry = 0 } = o;
  el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) ${ry ? `perspective(1800px) rotateY(${ry}deg) ` : ''}rotate(${r}deg) scale(${s})`;
  el.style.opacity = a;
  el.style.filter = b > 0.05 ? `blur(${b}px)` : '';
}

const FITS = [];

// Text split into letters for animating. Always textContent, and split by grapheme so Devanagari
// conjuncts stay whole. `maxW` shrinks the font so a long name still fits on screen.
function text(parent, value, css, maxW) {
  const e = mk(parent, 'div', css);
  e.classList.add('t');
  e._l = graphemes(str(value)).map((g) => {
    const s = document.createElement('span');
    s.textContent = g === ' ' ? '\u00a0' : g;
    e.appendChild(s);
    return s;
  });
  if (maxW) FITS.push([e, maxW]);
  return e;
}

function reveal(el, t, start, stag = 0.035, d = 0.5, from = 70) {
  el._l.forEach((c, i) => {
    const p = seg(t, start + i * stag, start + i * stag + d);
    const q = outB(p, 1.4);
    c.style.opacity = cl(p * 2);
    c.style.transform = `translateY(${(1 - q) * from}px) scale(${lerp(1.35, 1, q)})`;
    c.style.filter = p < 1 ? `blur(${(1 - p) * 9}px)` : '';
  });
}

// Breaks a title into at most `max` balanced lines.
function wrap(value, max, slack = 2) {
  const words = str(value).trim().split(/\s+/).filter(Boolean);
  const target = words.join(' ').length / max + slack;
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (lines.length === max || (last + ' ' + w).length <= target)) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.length ? lines : [''];
}

// Waits for fonts and images (a broken user image falls back to the template's own art), then fits
// long text. Resolves with the film's length in seconds.
async function ready(stage, fonts, duration) {
  await Promise.all(fonts.map(([f, sample]) => document.fonts.load(f, sample)));
  await document.fonts.ready;
  await Promise.all([...document.images].map(async (i) => {
    try {
      await i.decode();
    } catch {
      if (i.dataset.fallback) {
        console.warn(`Could not load ${i.src.slice(0, 80)}; using the template's own image.`);
        i.src = i.dataset.fallback;
        await i.decode();
      } else {
        throw new Error(`Could not load image ${i.src.slice(0, 120)}`);
      }
    }
  }));
  const hidden = [...stage.querySelectorAll('.sc')];
  hidden.forEach((s) => { s.style.display = 'block'; });
  for (const [e, maxW] of FITS) {
    // A few passes, because letter-spacing does not shrink with the font.
    for (let pass = 0; pass < 4 && e.offsetWidth > maxW; pass++) {
      e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * (maxW / e.offsetWidth) * 0.99}px`;
    }
  }
  hidden.forEach((s) => { s.style.display = 'none'; });
  return duration;
}
