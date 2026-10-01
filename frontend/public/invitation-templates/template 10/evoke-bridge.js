/**
 * Evoke editor live-preview bridge for the Temple Bells (template 10) wedding page.
 *
 * The invite reads its content from one shared object (`globalThis.__evInvitation`, exported by its
 * data module in js/app.js). This bridge fills that object from defaults.json merged with editor
 * data, section by section, mutating it in place, then asks the app to re-render
 * (`globalThis.__evRender`, set by the entry in js/app.js).
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;
  var PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;

  var invitation = window.__evInvitation || (window.__evInvitation = {});
  var defaults = null;
  var editorData = null;

  function isSafeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    if (/^data:(image|audio|video)\/[a-z0-9.+-]+;base64,/i.test(value.trim())) return true;
    try {
      var url = new URL(value, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) { return false; }
  }

  function merge(base, data) {
    var out = {};
    Object.keys(base || {}).concat(Object.keys(data || {})).forEach(function (key) {
      var b = (base && base[key]) || {};
      var d = data && data[key];
      var section = {};
      Object.keys(b).forEach(function (k) { section[k] = b[k]; });
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        Object.keys(d).forEach(function (k) { if (d[k] !== undefined && d[k] !== null) section[k] = d[k]; });
      }
      out[key] = section;
    });
    return out;
  }

  function media(value, fallback) {
    return isSafeUrl(value) ? value : (isSafeUrl(fallback) ? fallback : '');
  }

  function weddingIso(date, time) {
    var t = /^\d{1,2}:\d{2}$/.test(String(time || '').trim()) ? String(time).trim().padStart(5, '0') : '16:00';
    var when = new Date(String(date || '') + 'T' + t + ':00');
    return isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(function (x) { return x && typeof x === 'object'; }) : [];
  }

  /** Section-keyed editor content -> the invite's data shape (filled into the shared object). */
  function fill(c) {
    var couple = c.couple || {}, wed = c.wedding || {}, verse = c.verse || {}, gift = c.gift || {};
    var d = defaults || {};
    var next = {
      groom: { name: couple.groomName || '', short: couple.groomShort || couple.groomName || '', parents: couple.groomParents || '' },
      bride: { name: couple.brideName || '', short: couple.brideShort || couple.brideName || '', parents: couple.brideParents || '' },
      images: {
        groom: media(couple.groomPhoto, (d.couple || {}).groomPhoto),
        bride: media(couple.bridePhoto, (d.couple || {}).bridePhoto)
      },
      weddingDate: weddingIso(wed.date, wed.time),
      weddingDateLabel: wed.dateLabel || '',
      dateLine: wed.dateLine || '',
      place: { venue: wed.venue || '', city: wed.city || '' },
      verse: { text: verse.text || '', source: verse.source || '' },
      story: list((c.story || {}).items).filter(function (s) { return s.title || s.text; })
        .map(function (s) { return { year: s.year || '', title: s.title || '', text: s.text || '' }; }),
      events: list((c.events || {}).items).filter(function (e) { return e.title; })
        .map(function (e) { return { title: e.title, time: e.time || '', venue: e.venue || '', address: e.address || '' }; }),
      gift: {
        heading: gift.heading || '', message: gift.message || '', title: gift.title || '',
        name: gift.name || '', details: gift.details || '', note: gift.note || ''
      },
      gallery: list((c.gallery || {}).photos).map(function (p, i) {
        var fallback = list((d.gallery || {}).photos)[i] || {};
        return media(p.image, fallback.image);
      }).filter(Boolean)
    };
    window.__evMusic = media((c.music || {}).track, (d.music || {}).track);
    Object.keys(invitation).forEach(function (k) { delete invitation[k]; });
    Object.keys(next).forEach(function (k) { invitation[k] = next[k]; });
  }

  function apply() {
    if (!defaults) return;
    fill(merge(defaults, editorData));
    window.__evReady = true;
    if (typeof window.__evRender === 'function') window.__evRender();
  }

  fetch('defaults.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (data) { defaults = data || {}; apply(); });

  window.addEventListener('message', function (e) {
    if (e && e.source === window.parent && e.origin === PARENT_ORIGIN && e.data && e.data.channel === UPDATE && e.data.version === VERSION) {
      editorData = e.data.data;
      apply();
    }
  });

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: READY, version: VERSION }, PARENT_ORIGIN);
    }
  } catch (_) {}
})();
