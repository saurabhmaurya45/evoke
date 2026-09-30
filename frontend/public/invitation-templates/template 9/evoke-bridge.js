/**
 * Evoke editor live-preview bridge for the Château (template 9) wedding page.
 *
 * The page is a React app whose root component takes a `customData` invitation object and keeps
 * it in state, so editor data is mapped onto that shape and the root is re-rendered with it
 * (see the `standalone` entry at the end of js/app.js). defaults.json is merged under the editor
 * data section by section, so an untouched field keeps its sample value.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;
  var PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;
  var ACCENTS = ['#c9953a', '#6a9e6f', '#8e6fb5', '#b56f7a', '#5c8fa8', '#a8745c'];

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

  function mapsLink(url, query) {
    if (isSafeUrl(url)) return url;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query || '');
  }

  function weddingIso(date, time) {
    var t = /^\d{1,2}:\d{2}$/.test(String(time || '').trim()) ? String(time).trim().padStart(5, '0') : '16:00';
    var when = new Date(String(date || '') + 'T' + t + ':00');
    return isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
  }

  /** Section-keyed editor content -> the invite component's `customData` shape. */
  function toInvitation(c) {
    var couple = c.couple || {}, wed = c.wedding || {}, venue = c.venue || {}, dress = c.dressCode || {};
    var d = defaults || {};
    var events = (Array.isArray((c.events || {}).items) ? c.events.items : []).filter(function (e) { return e && e.title; });
    var colors = (Array.isArray(dress.colors) ? dress.colors : []).filter(function (x) { return x && x.hex; });
    return {
      groom: { name: couple.groomName || '', short: couple.groomName || '', fullName: couple.groomFullName || couple.groomName || '' },
      bride: { name: couple.brideName || '', short: couple.brideName || '', fullName: couple.brideFullName || couple.brideName || '' },
      weddingDate: weddingIso(wed.date, wed.time),
      weddingDateLabel: wed.dateLabel || '',
      weddingDateYearLabel: [wed.dateLabel, wed.place].filter(Boolean).join(' · '),
      introText: wed.introText || '',
      events: events.map(function (e, i) {
        return {
          time: e.time || '', label: e.title, desc: e.description || '', date: e.date || wed.dateLabel || '',
          emoji: e.emoji || '✨', accent: e.accent || ACCENTS[i % ACCENTS.length],
          locationName: e.location || '', locationMapUrl: mapsLink(e.mapUrl, [e.location, venue.name, venue.address].filter(Boolean).join(', '))
        };
      }),
      venue: {
        name: venue.name || '', address: venue.address || '',
        mapUrl: mapsLink(venue.mapUrl, [venue.name, venue.address].filter(Boolean).join(', '))
      },
      coordinator: { title: (c.contact || {}).title || '', phone: (c.contact || {}).phone || '' },
      registry: { title: (c.registry || {}).title || '', desc: (c.registry || {}).description || '' },
      images: {
        couple: media((c.couple || {}).image, (d.couple || {}).image),
        venue: media(venue.image, (d.venue || {}).image)
      },
      dressCode: { text: dress.text || '', colors: colors }
    };
  }

  function apply() {
    if (!defaults) return;
    var content = merge(defaults, editorData);
    window.__evContent = content;
    window.__evMusic = media((content.music || {}).track, (defaults.music || {}).track);
    var invitation = toInvitation(content);
    window.__evInitial = invitation;
    if (typeof window.__evRender === 'function') window.__evRender(invitation);
  }

  fetch('defaults.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (d) { defaults = d || {}; apply(); });

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
