/**
 * Evoke editor live-preview bridge for the Embroidered Garden wedding page (template 13).
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
  // The app's own translation keys, mapped to TemplateData paths.
  var DICT = {
    'countdown.title': 'countdown.title',
    'welcome.parents': 'welcome.parents',
    'events.title': 'venue.title',
    'events.subtitle': 'venue.subtitle',
    'program.title': 'program.title',
    'program.arrival': 'program.items.0.title',
    'program.ceremony': 'program.items.1.title',
    'program.reception': 'program.items.2.title',
    'program.dinner': 'program.items.3.title',
    'program.afterparty': 'program.items.4.title',
    'program.note': 'program.note',
    'dress.title': 'dress.title',
    'dress.main': 'dress.main',
    'dress.note': 'dress.note',
    'story.title': 'story.title',
    'story.text': 'story.text',
    'info.title': 'after.title',
    'info.subtitle': 'after.subtitle',
    'info.event1location': 'after.name',
    'info.event1city': 'after.place',
    'info.event1date': 'after.date',
    'info.event1time': 'after.time',
    'info.event1street': 'after.address1',
    'info.event1zip': 'after.address2',
    'info.event1text': 'after.text',
    'gifts.title': 'gifts.title',
    'gifts.text': 'gifts.text',
  };
  var LABELS = {
    'countdown.days': 'Days',
    'countdown.hours': 'Hours',
    'countdown.minutes': 'Minutes',
    'countdown.seconds': 'Seconds',
    'events.openMaps': 'Open in Maps',
    'events.addCalendar': 'Add to Calendar',
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

  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var u = new URL(value.trim(), window.location.href);
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

  window.__evDict = function (key) {
    if (DICT[key]) return window.__t(DICT[key]);
    return LABELS[key] || null;
  };

  window.__evFull = function (who) {
    return (window.__t('couple.' + who + 'Name') + ' ' + window.__t('couple.' + who + 'Surname')).trim();
  };

  window.__evCouple = function () {
    return window.__t('couple.brideName') + ' & ' + window.__t('couple.groomName');
  };

  // The app splits this on "-", so it must always be a real YYYY-MM-DD.
  window.__date = function () {
    var raw = window.__t('countdown.date').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(new Date(raw).getTime())) return raw;
    return String(getPath(defaults, 'countdown.date') || '2027-02-20');
  };

  // A calendar timestamp on the wedding day, or `addDays` after it.
  window.__cal = function (time, addDays) {
    var d = new Date(window.__date() + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + (addDays || 0));
    return d.toISOString().slice(0, 10).replace(/-/g, '') + time;
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
