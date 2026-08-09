/**
 * Evoke editor live-preview bridge for the Rosewood (Framer-exported) template.
 *
 * This is a compiled Framer bundle: content is baked into the JS and re-rendered
 * on hydration. There's no data layer, but Framer tags every editable text node
 * with a `data-framer-name` attribute we can target. So ALL default text lives
 * in defaults.json (the single source of truth); this bridge fetches it (for the
 * standalone preview) or receives it from the editor, then writes the values
 * onto the matching nodes. Nothing user-facing is hardcoded here — only the
 * structural `data-framer-name` hooks Framer assigns.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;

  var values = null; // current TemplateData (from defaults.json or the editor)
  var observer = null;
  var patchQueued = false;

  // Normalised `data-framer-name` -> where to read the value from + how to shape
  // it. `tf` transforms the couple names (the design shows them upper-cased and
  // stacked). `ml` means the value may contain line breaks.
  var MAP = {
    // Couple names (several stylistic variants across the page).
    'Arjun': { key: 'couple.groomName' },
    'Priya': { key: 'couple.brideName' },
    'ARJUN': { key: 'couple.groomName', tf: 'upper' },
    '& PRIYA': { key: 'couple.brideName', tf: 'ampUpper', ml: true },
    'ARJUN PRIYA': { tf: 'stacked', ml: true },

    // Invitation
    'you to join us in the wedding celebrations of': { key: 'invite.line1' },
    'On the following events': { key: 'invite.line2' },
    'INVITES': { key: 'invite.invites' },

    // Family
    'The Sharma Family': { key: 'family.name' },
    'With the heavenly blessings of Our late grandparents, Smt. Savitri Sharma and Shri Mohanlal Sharma.': { key: 'family.blessings', ml: true },
    'S/O Rajesh Sharma and Sunita Sharma': { key: 'family.groomParents', ml: true },
    'D/O Suresh Iyer and Lakshmi Iyer': { key: 'family.brideParents', ml: true },

    // (Events are handled per-card by applyEvents(), not here.)

    // Journey
    'The journey begins': { key: 'journey.title' },
    'Our families are excited that you are able to join us in celebrating what we hope will be one of the happiest days of our lives.': { key: 'journey.subtitle', ml: true },

    // Thank you
    'MEET THE': { key: 'thanks.title', ml: true },
    'Bride Groom': { key: 'thanks.body', ml: true },

    // RSVP
    'Looking forward to seeing you': { key: 'rsvp.title', ml: true },
    'Click the link to RSVP': { key: 'rsvp.link' },

    // Introducing the couple
    'Intro': { key: 'intro.small' },
    'Couple': { key: 'intro.heading' },

    // Guest info cards
    'Weather': { key: 'info.weatherTitle' },
    'It will be mostly cloudy with temperature reaching up to 22 degrees at the venue': { key: 'info.weatherBody', ml: true },
    'Staff': { key: 'info.staffTitle' },
    'We recommend the nearby lodge called VEGA near the venue for the staff members': { key: 'info.staffBody', ml: true },
    'Parking': { key: 'info.parkingTitle' },
    'Valet parking for all our guests will be available at the venue': { key: 'info.parkingBody', ml: true },

    // Guide
    'To help you feel at ease and enjoy every moment of the celebrations, we have gathered a few thoughtful details we would love for you to know before the big day': { key: 'guide.subtitle', ml: true },
    'Things to know': { key: 'guide.title' }
  };

  // Aliases: original (pre-baked) Framer names -> same fields, so the bridge
  // keeps working even if the bundle is re-imported with the original text.
  var ALIASES = {
    'Harpreet': 'Arjun',
    'Ritika': 'Priya',
    'HARPREET': 'ARJUN',
    '& RITIKA': '& PRIYA',
    'HARPREET RITIKA': 'ARJUN PRIYA',
    'The Kapoor Family': 'The Sharma Family',
    'With the heavenly blessings of Our late grandparents, Sdn. Gurmeet Kapoor and Sd. Maninder Singh.': 'With the heavenly blessings of Our late grandparents, Smt. Savitri Sharma and Shri Mohanlal Sharma.',
    'S/O Dharmender Singh and Jaya Kaur': 'S/O Rajesh Sharma and Sunita Sharma',
    'D/O Manak Kapoor and Rani Kapoor': 'D/O Suresh Iyer and Lakshmi Iyer',
    'Anand Karaj': 'Vivah (Pheras)'
  };
  Object.keys(ALIASES).forEach(function (from) {
    if (MAP[ALIASES[from]] && !MAP[from]) MAP[from] = MAP[ALIASES[from]];
  });

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }
  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function resolve(entry) {
    var groom = getPath(values, 'couple.groomName') || '';
    var bride = getPath(values, 'couple.brideName') || '';
    switch (entry.tf) {
      case 'upper':
        return String(getPath(values, entry.key) || '').toUpperCase();
      case 'ampUpper':
        return '&\n' + bride.toUpperCase();
      case 'stacked':
        return groom.toUpperCase() + '\n\n' + bride.toUpperCase();
      default:
        return getPath(values, entry.key);
    }
  }

  // Write a value into a Framer text node while preserving its inline styling by
  // targeting the innermost styled element (span / anchor / paragraph).
  function write(el, value, ml) {
    if (value === undefined || value === null) return;
    var p = el.querySelector('p');
    var target = (p && p.querySelector('span, a')) || p || el;
    if (ml) {
      target.innerHTML = esc(value).replace(/\n/g, '<br>');
    } else {
      target.textContent = String(value);
    }
  }

  // The six event cards, identified by their title node's data-framer-name (the
  // baked value; originals kept as fallbacks for a fresh re-import).
  var EVENT_ATTRS = [
    ['Haldi'],
    ['Cocktail'],
    ['Pre-wedding'],
    ['Vivah (Pheras)', 'Anand Karaj'],
    ['Reception'],
    ['Mehendi'],
  ];

  function findByNames(names) {
    var all = document.querySelectorAll('[data-framer-name]');
    for (var i = 0; i < all.length; i++) {
      var nm = norm(all[i].getAttribute('data-framer-name'));
      for (var j = 0; j < names.length; j++) if (nm === names[j]) return all[i];
    }
    return null;
  }

  // Per-card event details: name, schedule, directions link and photo. Applied
  // to every SSR/hydrated variant (findByNames returns the first; we scope the
  // rest within that card, and repeat for all cards sharing the title).
  function applyEvents(items) {
    if (!Array.isArray(items)) return;
    for (var i = 0; i < EVENT_ATTRS.length; i++) {
      var item = items[i];
      if (!item) continue;
      var titles = document.querySelectorAll('[data-framer-name]');
      for (var t = 0; t < titles.length; t++) {
        var nm = norm(titles[t].getAttribute('data-framer-name'));
        if (EVENT_ATTRS[i].indexOf(nm) === -1) continue;
        var titleEl = titles[t];
        if (item.name) write(titleEl, item.name, false);
        var card = titleEl.closest('div[data-framer-name="Variant 1"]') || titleEl.parentElement;
        if (!card) continue;
        // Schedule block (its data-framer-name starts with the original date).
        if (item.schedule) {
          var kids = card.querySelectorAll('[data-framer-name]');
          for (var k = 0; k < kids.length; k++) {
            if (norm(kids[k].getAttribute('data-framer-name')).indexOf('Friday, March') === 0) {
              write(kids[k], item.schedule, true);
              break;
            }
          }
        }
        // Directions link.
        var a = card.querySelector('a');
        if (a && item.directionsUrl) {
          a.setAttribute('href', item.directionsUrl);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
        }
        // Photo.
        if (item.photo) {
          var img = card.querySelector('img');
          if (img) {
            img.src = item.photo;
            img.removeAttribute('srcset');
          }
        }
      }
    }
  }

  // Couple photos, keyed by the image filename fragments they use across the
  // desktop + mobile variants. Setting any field replaces that photo everywhere.
  var GALLERY_MAP = {
    photo1: ['street-couple'],
    photo2: ['QRe8j7JHXlYpERIIrFyIYWCUokw'],
    photo3: ['slrullTHt9ZUkRLTyogsjsXBP0'],
    photo4: ['eJ9mG3rO9YZAeikJPvJ0e4G2rDE'],
    photo5: ['bUg2TpeRyjrg4ZuEjlI16PByyzE'],
    photo6: ['palace-couple-wide'],
    photo7: ['sunset-couple-frame', 'bOW1f3pjThAQpndqrhEN5obZKg'],
  };
  function applyGallery(g) {
    if (!g || typeof g !== 'object') return;
    Object.keys(GALLERY_MAP).forEach(function (key) {
      var url = g[key];
      if (!url) return;
      GALLERY_MAP[key].forEach(function (frag) {
        var imgs = document.querySelectorAll('img[src*="' + frag + '"]');
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].src = String(url);
          imgs[i].removeAttribute('srcset');
        }
      });
    });
  }

  function applyValues() {
    if (!values || !document.body) return;
    if (observer) observer.disconnect();
    try {
      var nodes = document.querySelectorAll('[data-framer-name]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var entry = MAP[norm(el.getAttribute('data-framer-name'))];
        if (!entry) continue;
        var v = resolve(entry);
        if (v === undefined) continue;
        write(el, v, !!entry.ml);
      }
      applyEvents(getPath(values, 'events.items'));
      applyGallery(getPath(values, 'gallery'));
      swapMantra();
      swapMonogram();
    } catch (err) {
      /* never let one bad node stop future patches */
    } finally {
      reconnect();
    }
  }

  // ---- Footer ornament -> Mangala mantra --------------------------------------
  var mantraUri = null;
  function mantraDataUri() {
    if (mantraUri) return mantraUri;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 604 344" preserveAspectRatio="xMidYMid meet">' +
      '<style>text{fill:rgb(173,99,57);font-family:"Cormorant Garamond","Jacques Francois",Georgia,serif;}' +
      '.dev{font-family:"Nirmala UI","Noto Sans Devanagari","Mangal",serif;}</style>' +
      '<text class="dev" x="302" y="70" text-anchor="middle" font-size="40">ॐ मंगलं भगवान् विष्णुः</text>' +
      '<text class="dev" x="302" y="128" text-anchor="middle" font-size="40">मंगलं गरुडध्वजः</text>' +
      '<text x="302" y="212" text-anchor="middle" font-size="30" font-style="italic">Om Mangalam Bhagavan Vishnuh,</text>' +
      '<text x="302" y="252" text-anchor="middle" font-size="30" font-style="italic">Mangalam Garudadhwajah</text>' +
      '<text x="302" y="312" text-anchor="middle" font-size="26">❦</text>' +
      '</svg>';
    mantraUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return mantraUri;
  }
  function swapMantra() {
    var uri = mantraDataUri();
    var imgs = document.querySelectorAll('img[src*="footer-ornament"]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = uri;
      imgs[i].removeAttribute('srcset');
      imgs[i].style.objectFit = 'contain';
    }
  }

  // ---- Couple monogram (the "H R" badge) -> dynamic initials + heart ----------
  var MONOGRAM_KEYS = ['d0tGR6rEZBEOwKF9RFkbSmq5jg', '1j9dlFzlXu71Uhtxenrhp7M'];
  var MONOGRAM_SELECTOR = MONOGRAM_KEYS.map(function (k) {
    return 'img[src*="' + k + '"]';
  }).join(',');
  function monogramDataUri() {
    var gi = (getPath(values, 'couple.groomName') || 'A').charAt(0).toUpperCase();
    var bi = (getPath(values, 'couple.brideName') || 'P').charAt(0).toUpperCase();
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 296" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
      '<radialGradient id="bg" cx="50%" cy="42%" r="75%">' +
      '<stop offset="0%" stop-color="#fbdfe4"/><stop offset="100%" stop-color="#efb2be"/></radialGradient>' +
      '<radialGradient id="hg" cx="50%" cy="32%" r="75%">' +
      '<stop offset="0%" stop-color="#c85c44"/><stop offset="100%" stop-color="#a5402c"/></radialGradient>' +
      '</defs>' +
      '<rect width="320" height="296" fill="url(#bg)"/>' +
      '<g transform="translate(0,8) scale(10)">' +
      '<path fill="url(#hg)" d="M23.6,0c-3.4,0-6.3,2.7-7.6,5.6C14.7,2.7,11.8,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.4,9.5,11.9,16,21.2c6.1-9.3,16-12.1,16-21.2C32,3.8,28.2,0,23.6,0z"/>' +
      '</g>' +
      '<text x="126" y="168" text-anchor="middle" font-family="Georgia,serif" font-weight="600" font-size="82" fill="#fff6e9">' + gi + '</text>' +
      '<text x="194" y="168" text-anchor="middle" font-family="Georgia,serif" font-weight="600" font-size="82" fill="#fff6e9">' + bi + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function swapMonogram() {
    var imgs = document.querySelectorAll(MONOGRAM_SELECTOR);
    if (!imgs.length) return;
    var uri = monogramDataUri();
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = uri;
      imgs[i].removeAttribute('srcset');
      imgs[i].style.objectFit = 'cover';
    }
  }

  // ---- Scheduling / observation ----------------------------------------------
  function schedulePatch() {
    if (patchQueued) return;
    patchQueued = true;
    (window.requestAnimationFrame || window.setTimeout)(function () {
      patchQueued = false;
      applyValues();
    }, 0);
  }
  function reconnect() {
    if (!document.body) return;
    if (!observer) {
      observer = new MutationObserver(function () { schedulePatch(); });
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src', 'srcset'],
    });
  }

  function useValues(next) {
    if (next && typeof next === 'object') {
      values = next;
      schedulePatch();
      // Re-apply through late Framer hydration passes.
      var n = 0;
      var t = window.setInterval(function () {
        schedulePatch();
        if (++n >= 8) window.clearInterval(t);
      }, 350);
    }
  }

  // Editor pushes the live TemplateData; it wins over the fetched defaults.
  window.addEventListener('message', function (e) {
    if (e && e.data && e.data.channel === UPDATE && e.data.version === VERSION) {
      useValues(e.data.data);
    }
  });

  function start() {
    reconnect();
    // Standalone preview: pull the same defaults the editor seeds from, so the
    // page never shows the baked placeholder text.
    try {
      fetch('defaults.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && !values) useValues(d); })
        .catch(function () {});
    } catch (_) {}

    announceReady();
  }

  // Announce readiness repeatedly for a short window — the editor only starts
  // pushing live edits once it hears this, and a single message can be missed
  // while a heavy Framer bundle is still booting.
  function announceReady() {
    if (!(window.parent && window.parent !== window)) return;
    var n = 0;
    function ping() {
      try {
        window.parent.postMessage({ channel: READY, version: VERSION }, '*');
      } catch (_) {}
      if (++n < 12) window.setTimeout(ping, 250);
    }
    ping();
  }

  // Post READY immediately too (covers the case where the editor is already
  // listening before DOMContentLoaded).
  announceReady();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
