/**
 * Evoke editor live-preview bridge for the Ayodhya wedding page (template 11).
 *
 * The page is a static Framer export. Every editable node carries a `data-ev*` attribute naming the
 * TemplateData path it shows, repeated across Framer's desktop / tablet / mobile variants:
 *
 *   data-ev="couple.groomName"            text (optional data-ev-tf="upper" for the all-caps hero)
 *   data-ev-href="events.items.0.mapUrl"  link target of an <a>
 *   data-ev-img="gallery.photo1"          <img src>
 *   data-ev-link="social.instagramUrl"    a whole block that opens a link on click
 *   data-ev-countdown="countdown.date"    live clock: boxes for days, hours, minutes and seconds
 *   data-ev-audio="music.track"           the background-music <audio>
 *   data-ev-rsvp="rsvp.whatsapp"          the RSVP dialog (adds a WhatsApp button when a number is set)
 *
 * All default content lives in defaults.json (the single source of truth): the standalone preview
 * fetches it, the editor pushes live TemplateData over `evoke:preview-update`, and the editor's
 * values win. Text is only ever written with textContent, and every URL is checked first.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;
  var PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;

  var defaults = null;
  var editor = null;
  var values = null;
  var clockTimer = null;

  // ---- helpers -----------------------------------------------------------------------------
  function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function getPath(obj, path) {
    var cur = obj;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // Defaults overlaid with the editor's data, section by section; list items merge by index so an
  // item the editor leaves half-filled keeps the template's own text for the rest.
  function merge(base, data) {
    if (Array.isArray(base) || Array.isArray(data)) {
      var out = [];
      var len = Math.max((base || []).length, (data || []).length);
      for (var i = 0; i < len; i++) out.push(merge((base || [])[i], (data || [])[i]));
      return out;
    }
    if (isObject(base) || isObject(data)) {
      var res = {};
      Object.keys(base || {}).forEach(function (k) { res[k] = base[k]; });
      Object.keys(data || {}).forEach(function (k) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        var d = data[k];
        if (d === undefined || d === null) return;
        res[k] = isObject(d) || Array.isArray(d) ? merge(res[k], d) : d;
      });
      return res;
    }
    return data !== undefined && data !== null ? data : base;
  }

  function safeUrl(value, kinds) {
    if (typeof value !== 'string' || !value.trim()) return '';
    var v = value.trim();
    if (kinds && kinds.indexOf('data') !== -1 && /^data:(image|audio)\/[a-z0-9.+-]+;base64,/i.test(v)) return v;
    try {
      var u = new URL(v, window.location.href);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  function write(el, value, transform) {
    var s = String(value == null ? '' : value);
    if (transform === 'upper') s = s.toUpperCase();
    if (s.indexOf('\n') === -1) {
      el.textContent = s;
      return;
    }
    el.textContent = '';
    s.split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }

  function each(selector, fn) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  // ---- applying values ---------------------------------------------------------------------
  function applyText() {
    each('[data-ev]', function (el) {
      var v = getPath(values, el.getAttribute('data-ev'));
      if (typeof v === 'string' || typeof v === 'number') write(el, v, el.getAttribute('data-ev-tf'));
    });
  }

  function applyLinks() {
    each('[data-ev-href]', function (el) {
      var url = safeUrl(getPath(values, el.getAttribute('data-ev-href')));
      if (url) {
        el.setAttribute('href', url);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
    each('[data-ev-link]', function (el) {
      var url = safeUrl(getPath(values, el.getAttribute('data-ev-link')));
      el.__evLink = url;
      el.style.cursor = url ? 'pointer' : '';
      if (el.__evBound) return;
      el.__evBound = true;
      el.addEventListener('click', function () {
        if (el.__evLink) window.open(el.__evLink, '_blank', 'noopener');
      });
    });
  }

  function applyImages() {
    each('[data-ev-img]', function (img) {
      var url = safeUrl(getPath(values, img.getAttribute('data-ev-img')), ['data']);
      if (!url || img.src === url) return;
      img.setAttribute('src', url);
      img.removeAttribute('srcset');
    });
  }

  function applyAudio() {
    each('[data-ev-audio]', function (audio) {
      var url = safeUrl(getPath(values, audio.getAttribute('data-ev-audio')), ['data']);
      if (!url || audio.src === url) return;
      var wasPlaying = !audio.paused;
      audio.setAttribute('src', url);
      audio.load();
      if (wasPlaying) audio.play().catch(function () {});
    });
  }

  // ---- countdown ---------------------------------------------------------------------------
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // One box per unit. Built once, then only the numbers change, so the clock doesn't flicker.
  function renderClock(el, parts) {
    if (!el.__evBoxes) {
      el.textContent = '';
      el.__evBoxes = ['Days', 'Hours', 'Minutes', 'Seconds'].map(function (label) {
        var box = document.createElement('span');
        box.className = 'ev-clock-box';
        var num = document.createElement('span');
        num.className = 'ev-clock-num';
        var lab = document.createElement('span');
        lab.className = 'ev-clock-label';
        lab.textContent = label;
        box.appendChild(num);
        box.appendChild(lab);
        el.appendChild(box);
        return num;
      });
    }
    el.__evBoxes.forEach(function (num, i) {
      if (num.textContent !== parts[i]) num.textContent = parts[i];
    });
  }

  function tickClock() {
    each('[data-ev-countdown]', function (el) {
      var raw = getPath(values, el.getAttribute('data-ev-countdown'));
      var when = typeof raw === 'string' && raw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00' : raw) : null;
      var ms = when && !isNaN(when.getTime()) ? Math.max(0, when.getTime() - Date.now()) : 0;
      var total = Math.floor(ms / 1000);
      var d = Math.floor(total / 86400);
      var h = Math.floor((total % 86400) / 3600);
      var m = Math.floor((total % 3600) / 60);
      var s = total % 60;
      renderClock(el, [pad(d), pad(h), pad(m), pad(s)]);
      el.style.visibility = 'visible'; // Framer ships the clock hidden until its (absent) script runs
    });
  }

  // The countdown sits over busy artwork, so its text needs its own contrast.
  function styleClock() {
    if (document.getElementById('ev-clock-style')) return;
    var style = document.createElement('style');
    style.id = 'ev-clock-style';
    style.textContent =
      '[data-ev="countdown.title"]{text-shadow:0 2px 4px rgba(20,10,35,.95),0 0 18px rgba(20,10,35,.85)}' +
      '[data-ev-countdown]{display:flex!important;justify-content:center;gap:clamp(6px,1.4vw,14px);width:auto!important;white-space:normal!important}' +
      '.ev-clock-box{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:clamp(66px,8vw,104px);padding:clamp(8px,1vw,14px) 2px;box-sizing:border-box;border-radius:10px;' +
      'background:rgba(25,12,45,.72);border:1px solid rgba(255,226,170,.65);box-shadow:0 6px 18px rgba(0,0,0,.35)}' +
      '.ev-clock-num{font-size:clamp(26px,3.2vw,44px);line-height:1.1;font-weight:600;color:#fff;font-variant-numeric:tabular-nums}' +
      '.ev-clock-label{margin-top:4px;font-size:clamp(10px,1vw,13px);line-height:1.2;letter-spacing:.06em;text-transform:uppercase;color:#ffe2aa}';
    document.head.appendChild(style);
  }

  function startClock() {
    styleClock();
    tickClock();
    if (!clockTimer) clockTimer = window.setInterval(tickClock, 1000);
  }

  // ---- RSVP dialog -------------------------------------------------------------------------
  function applyRsvp() {
    each('dialog[data-ev-rsvp]', function (dialog) {
      var digits = String(getPath(values, dialog.getAttribute('data-ev-rsvp')) || '').replace(/\D/g, '');
      var existing = dialog.querySelector('a.ev-wa');
      if (digits.length < 7 || digits.length > 15) {
        if (existing) existing.remove();
        return;
      }
      var groom = getPath(values, 'couple.groomName') || '';
      var bride = getPath(values, 'couple.brideName') || '';
      var message = 'Hello! I would like to RSVP for the wedding of ' + groom + ' & ' + bride + '.';
      var href = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
      if (!existing) {
        existing = document.createElement('a');
        existing.className = 'ev-wa';
        existing.target = '_blank';
        existing.rel = 'noopener noreferrer';
        existing.textContent = 'Chat on WhatsApp';
        existing.style.cssText =
          'display:inline-block;margin-top:20px;padding:10px 25px;border-radius:24px;background:#25d366;color:#fff;text-decoration:none;font:600 16px Georgia,serif';
        var form = dialog.querySelector('form');
        dialog.insertBefore(existing, form || null);
      }
      existing.href = href;
    });
  }

  // The page is shown in a sandboxed iframe without `allow-forms`, which silently blocks the
  // pop-up's native <form method="dialog"> Close button. Close it ourselves.
  document.addEventListener('click', function (e) {
    var t = e.target;
    var btn = t && t.closest ? t.closest('dialog button') : null;
    if (btn) {
      e.preventDefault();
      var d = btn.closest('dialog');
      if (d && d.close) d.close();
    } else if (t && t.tagName === 'DIALOG' && t.close) {
      t.close(); // click on the backdrop
    }
  });

  function apply() {
    if (!values || !document.body) return;
    applyText();
    applyLinks();
    applyImages();
    applyAudio();
    applyRsvp();
    startClock();
  }

  function render() {
    if (!defaults) return;
    values = merge(defaults, editor);
    apply();
  }

  // ---- plumbing ----------------------------------------------------------------------------
  window.addEventListener('message', function (e) {
    if (
      e &&
      e.source === window.parent &&
      e.origin === PARENT_ORIGIN &&
      e.data &&
      e.data.channel === UPDATE &&
      e.data.version === VERSION &&
      isObject(e.data.data)
    ) {
      editor = e.data.data;
      render();
    }
  });

  function announceReady() {
    if (!(window.parent && window.parent !== window)) return;
    var n = 0;
    (function ping() {
      try {
        window.parent.postMessage({ channel: READY, version: VERSION }, PARENT_ORIGIN);
      } catch (_) {}
      if (++n < 12) window.setTimeout(ping, 250);
    })();
  }

  function start() {
    try {
      fetch('defaults.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && isObject(d)) {
            defaults = d;
            render();
          }
        })
        .catch(function () {});
    } catch (_) {}
    announceReady();
  }

  announceReady();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
