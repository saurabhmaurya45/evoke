/**
 * Evoke editor live-preview bridge for the Lace wedding page (template 12).
 *
 * The page is a compiled React app whose text was patched to read from here: __t("couple.brideName")
 * returns the current value of that TemplateData path, and React escapes whatever it renders.
 *
 * All default content lives in defaults.json (the single source of truth): the standalone preview
 * fetches it, the editor pushes live TemplateData over `evoke:preview-update`, and the editor's
 * values win. Each change re-renders the app in place, so the page keeps its scroll position.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;
  var PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;
  var DICT = {
    'events.title': 'day.title',
    'gifts.title': 'gift.title',
    'gifts.text': 'gift.text',
    'gifts.options': 'gift.options',
    'gifts.bank': 'gift.details',
  };

  var defaults = null;
  var editor = null;
  var values = {};

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

  // Defaults overlaid with the editor's data; list items merge by index.
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

  function safeUrl(value, allowData) {
    if (typeof value !== 'string' || !value.trim()) return '';
    var v = value.trim();
    if (allowData && /^data:audio\/[a-z0-9.+-]+;base64,/i.test(v)) return v;
    try {
      var u = new URL(v, window.location.href);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  // ---- what the app reads -------------------------------------------------------------------
  window.__t = function (path) {
    var v = getPath(values, path);
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };

  window.__url = function (path) {
    return safeUrl(getPath(values, path)) || '#';
  };

  // The couple's names come from their own fields, so renaming them updates this line too.
  window.__evWelcome = function () {
    return window.__t('couple.brideName') + ' & ' + window.__t('couple.groomName') + ' ' + window.__t('welcome.message');
  };

  window.__evDict = function (key) {
    return DICT[key] ? window.__t(DICT[key]) : null;
  };

  // The app splits this on "-", so it must always be a real YYYY-MM-DD.
  window.__date = function () {
    var raw = window.__t('countdown.date').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(new Date(raw).getTime())) return raw;
    return String(getPath(defaults, 'countdown.date') || '2027-02-14');
  };

  window.__evMusic = function () {
    return safeUrl(getPath(values, 'music.track'), true);
  };

  // Gallery photos that are set and safe to show; with none, the section is left out.
  window.__evGallery = function () {
    var items = getPath(values, 'gallery.items');
    if (!Array.isArray(items)) return [];
    return items
      .map(function (it) {
        var v = it && it.image;
        if (typeof v !== 'string') return '';
        return /^data:image\/[a-z0-9.+-]+;base64,/i.test(v.trim()) ? v.trim() : safeUrl(v);
      })
      .filter(Boolean);
  };

  // ---- rendering -----------------------------------------------------------------------------
  function render() {
    if (!defaults || !window.__evRender) return;
    values = merge(defaults, editor);
    window.__evRender();
    var audio = window.__evAudio;
    var track = window.__evMusic();
    if (audio && track && audio.src !== track) {
      var wasPlaying = !audio.paused;
      audio.src = track;
      if (wasPlaying) audio.play().catch(function () {});
    }
  }

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

  window.__evStart = function () {
    fetch('defaults.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        defaults = isObject(d) ? d : {};
        render();
      })
      .catch(function () {
        defaults = {};
        render();
      });
    announceReady();
  };
})();
