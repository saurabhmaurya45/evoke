/**
 * Evoke editor live-preview bridge for the Golden Promise (template 7) wedding page.
 *
 * The page's editable nodes carry `data-ev` / `data-ev-html` / `data-ev-img` /
 * `data-ev-src` / `data-ev-href` / `data-ev-list` hooks, so section-keyed editor
 * data binds straight onto them. The four ceremony blocks are rebuilt from a
 * list so items can be added or removed.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;
  var PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;

  function isSafeUrl(value) {
    try {
      var url = new URL(String(value), window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) { return false; }
  }

  // Flat "section.field" path -> the hook name the markup carries.
  var TEXT = {
    'family.brideName': 'brideName',
    'family.groomName': 'groomName',
    'family.joiner': 'joiner',
    'family.blessingsLabel': 'blessingsLabel',
    'saveTheDate.day': 'scratchDay',
    'saveTheDate.month': 'scratchMonth',
    'saveTheDate.year': 'scratchYear',
    'saveTheDate.surpriseMessage': 'surpriseMessage',
    'events.label': 'eventsLabel',
    'venue.label': 'venueLabel',
    'venue.name': 'venueName',
    'memories.label': 'memoriesLabel',
    'memories.caption': 'memoriesCaption',
    'footer.coupleName': 'footerCoupleName',
    'footer.rsvpHeading': 'rsvpContactsHeading',
    'footer.wishesHeading': 'wishesHeading'
  };
  var HTML = {
    'family.invocation': 'invocation',
    'family.blessingsNames': 'blessingsNames',
    'family.inviteLine': 'inviteLine',
    'family.brideFamily': 'brideFamily',
    'family.groomFamily': 'groomFamily',
    'events.heading': 'eventsHeading',
    'venue.heading': 'venueHeading',
    'venue.address': 'venueAddress',
    'memories.heading': 'memoriesHeading'
  };
  var IMG = {
    'hero.image': 'heroImage',
    'family.deityImage': 'deityImage',
    'venue.image': 'venueImage'
  };
  var SRC = {
    'hero.entryVideo': 'entryVideo',
    'hero.audioTrack': 'audioTrack',
    'memories.video': 'memoriesVideo'
  };
  var LIST = {
    'footer.rsvpContacts': 'rsvpContacts',
    'footer.wishesFrom': 'wishesFrom'
  };

  // Sample names in this template's own copy, by the data path that replaces them.
  var SAMPLE_NAMES = {
    'family.groomName': 'Aryan',
    'family.brideName': 'Ishita'
  };
  // Text fields whose copy mentions the couple by name.
  var NAME_COPY = { 'footer.coupleName': true, 'family.joiner': true, 'memories.caption': true, 'saveTheDate.surpriseMessage': true };

  // Copy fields whose sample text names the couple (e.g. "The day when Karan &
  // Nisha will tie the knot"). Those names follow the name fields: each whole-word
  // sample name is swapped for the current one, so the sentence never shows the
  // sample couple next to the user's own names.
  function withNames(text, data) {
    var out = String(text);
    Object.keys(SAMPLE_NAMES).forEach(function (path) {
      var current = get(data, path);
      if (current === undefined || current === null) return;
      var re = new RegExp('(^|[^\p{L}])' + SAMPLE_NAMES[path] + '(?![\p{L}])', 'gu');
      out = out.replace(re, function (_, before) { return before + String(current); });
    });
    return out;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function get(data, path) {
    var parts = path.split('.');
    var section = data[parts[0]];
    if (!section || typeof section !== 'object') return undefined;
    return section[parts[1]];
  }

  function setAll(selector, apply) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) apply(nodes[i]);
  }

  /** Re-point a <video>/<audio> <source> and reload the owning media element. */
  function setMediaSource(el, url) {
    el.src = url;
    var media = el.parentElement;
    if (media && typeof media.load === 'function') {
      try { media.load(); } catch (_) {}
    }
  }

  function rebuildEvents(items) {
    var list = document.getElementById('eventsList');
    if (!list || !Array.isArray(items)) return;
    var visible = items.filter(function (it) {
      return it && (it.title || it.date || it.venue);
    });
    if (!visible.length) return;
    var sep =
      '<div class="event-sep reveal"><div class="event-sep-line"></div>' +
      '<div class="event-sep-dot"></div><div class="event-sep-line"></div></div>';
    list.innerHTML = visible
      .map(function (ev, i) {
        var img = ev.image && isSafeUrl(ev.image)
          ? '<div class="event-img-wrap"><img src="' + esc(ev.image) + '" alt="' + esc(ev.title || '') + '" loading="lazy" onerror="this.remove()"></div>'
          : '';
        var info = '';
        if (ev.time) info += '<p><strong>Time:</strong> ' + esc(ev.time) + '</p>';
        if (ev.venue) info += '<p><strong>Venue:</strong> ' + esc(ev.venue) + '</p>';
        if (ev.dressCode) info += '<p><strong>Dress Code:</strong> ' + esc(ev.dressCode) + '</p>';
        return (
          (i ? sep : '') +
          '<div class="event-block reveal in">' +
          '<div class="text-center mb-4">' +
          '<p class="event-subtitle">' + esc(ev.date || '') + '</p>' +
          '<h3 class="event-title">' + esc(ev.title || 'Celebration') + '</h3>' +
          '</div>' +
          img +
          (info ? '<div class="event-info-box reveal in">' + info + '</div>' : '') +
          '</div>'
        );
      })
      .join('');
  }

  function rebuildList(hook, items) {
    if (!Array.isArray(items)) return;
    var visible = items.filter(function (it) { return it && it.text; });
    if (!visible.length) return;
    setAll('[data-ev-list="' + hook + '"]', function (el) {
      el.innerHTML = visible.map(function (it) { return '<li>' + esc(it.text) + '</li>'; }).join('');
    });
  }

  function applyEditorData(data) {
    if (!data || typeof data !== 'object') return;

    Object.keys(TEXT).forEach(function (path) {
      var v = get(data, path);
      if (v === undefined) return;
      var text = v == null ? '' : NAME_COPY[path] ? withNames(v, data) : String(v);
      setAll('[data-ev="' + TEXT[path] + '"]', function (el) {
        el.textContent = text;
      });
    });

    Object.keys(HTML).forEach(function (path) {
      var v = get(data, path);
      if (v === undefined) return;
      setAll('[data-ev-html="' + HTML[path] + '"]', function (el) {
        el.innerHTML = v == null ? '' : String(v);
      });
    });

    Object.keys(IMG).forEach(function (path) {
      var v = get(data, path);
      if (!v || !isSafeUrl(v)) return;
      setAll('[data-ev-img="' + IMG[path] + '"]', function (el) {
        el.src = String(v);
        el.style.display = '';
      });
    });

    Object.keys(SRC).forEach(function (path) {
      var v = get(data, path);
      if (!v || !isSafeUrl(v)) return;
      setAll('[data-ev-src="' + SRC[path] + '"]', function (el) {
        if (el.tagName === 'SOURCE') setMediaSource(el, String(v));
        else el.src = String(v);
      });
    });

    Object.keys(LIST).forEach(function (path) {
      rebuildList(LIST[path], get(data, path));
    });

    var dirUrl = get(data, 'venue.directionsUrl');
    if (dirUrl && isSafeUrl(dirUrl)) {
      setAll('[data-ev-href="directionsUrl"]', function (el) { el.href = String(dirUrl); });
    }

    // Countdown target: combine date + time (local). Stashed on window so it
    // also applies when the countdown starts later (after the scratch reveal).
    var std = data.saveTheDate || {};
    if (std.targetDate) {
      var t = String(std.targetTime || '10:00');
      var when = new Date(String(std.targetDate) + 'T' + (t.length === 5 ? t : '10:00') + ':00');
      if (!isNaN(when.getTime())) {
        window.__evokeTarget = when.getTime();
        if (typeof window.__setWeddingTarget === 'function') window.__setWeddingTarget(when.getTime());
      }
    }

    rebuildEvents((data.events && data.events.items) || null);
    syncGuessOptions(data);
  }

  // "Who will get emotional first?" — one option per partner. The label is a
  // data-ev hook; the submitted value and the initial on the circle follow it.
  function syncGuessOptions(data) {
    ['groomName', 'brideName'].forEach(function (key) {
      var name = get(data, 'family.' + key);
      if (name === undefined || name === null) return;
      name = String(name);
      setAll('[data-ev-guess="' + key + '"]', function (opt) {
        var input = opt.querySelector('input');
        var face = opt.querySelector('.circle-face');
        if (input) input.value = name;
        if (face) face.textContent = name.charAt(0).toUpperCase();
      });
    });
  }

  window.addEventListener('message', function (e) {
    if (e && e.source === window.parent && e.origin === PARENT_ORIGIN && e.data && e.data.channel === UPDATE && e.data.version === VERSION) {
      applyEditorData(e.data.data);
    }
  });

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: READY, version: VERSION }, PARENT_ORIGIN);
    }
  } catch (_) {}
})();
