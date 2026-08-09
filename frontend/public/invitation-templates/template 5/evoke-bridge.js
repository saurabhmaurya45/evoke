/**
 * Evoke editor live-preview bridge for the Maroon & Gold (variant 3) template.
 *
 * The template's editable content carries `data-ev` / `data-ev-html` /
 * `data-ev-img` / `data-ev-href` hooks, so we bind the editor's section-keyed
 * data straight onto those nodes — no text matching, no hydration to fight.
 * Events and gallery are rebuilt from their lists so items can be added/removed.
 */
(function () {
  'use strict';

  var UPDATE = 'evoke:preview-update';
  var READY = 'evoke:preview-ready';
  var VERSION = 1;

  // Flat data-path -> the value the hooks expect. Keys match schema.json.
  var TEXT = {
    'hero.groomName': 'groomName',
    'hero.brideName': 'brideName',
    'hero.invocation': 'invocation',
    'hero.inviteLine': 'inviteLine',
    'hero.tagline': 'tagline',
    'hero.dateChip': 'dateChip',
    'countdown.subtitle': 'countdownSub',
    'countdown.bigDate': 'bigDate',
    'ceremony.intro': 'ceremonyIntro',
    'ceremony.mid': 'ceremonyMid',
    'invitee.name': 'inviteeName',
    'invitee.firmName': 'firmName',
    'footer.closing': 'footerClosing',
    'footer.small': 'footerSmall'
  };
  var HTML = {
    'ceremony.venue': 'ceremonyVenue',
    'profiles.groomDesc': 'groomDesc',
    'profiles.brideDesc': 'brideDesc',
    'venue.address': 'venueAddress',
    'invitee.address': 'inviteeAddress',
    'invitee.firmAddress': 'firmAddress'
  };
  var IMG = {
    'ceremony.photo': 'ceremonyPhoto',
    'profiles.groomPhoto': 'groomPhoto',
    'profiles.bridePhoto': 'bridePhoto'
  };

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

  function rebuildEvents(items) {
    var grid = document.getElementById('eventsGrid');
    if (!grid || !Array.isArray(items)) return;
    var visible = items.filter(function (it) {
      return it && (it.title || it.when || it.time);
    });
    if (!visible.length) return;
    var icon =
      '<svg class="icon" viewBox="0 0 24 24" fill="#c9a227" aria-hidden="true">' +
      '<path d="M12 21s-7.5-4.9-9.7-9A5.6 5.6 0 0 1 12 6.4 5.6 5.6 0 0 1 21.7 12c-2.2 4.1-9.7 9-9.7 9z"/></svg>';
    grid.innerHTML = visible
      .map(function (ev, i) {
        return (
          '<div class="event-card reveal in' + (i % 3 ? ' d' + (i % 3) : '') + '">' +
          icon +
          '<h3>' + esc(ev.title || 'Celebration') + '</h3>' +
          (ev.when ? '<p class="when">' + esc(ev.when) + '</p>' : '') +
          (ev.time ? '<p class="time">' + esc(ev.time) + '</p>' : '') +
          '</div>'
        );
      })
      .join('');
  }

  var GALLERY_BG = ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6'];
  function rebuildGallery(items) {
    var grid = document.getElementById('galleryGrid');
    if (!grid || !Array.isArray(items)) return;
    var visible = items.filter(function (it) {
      return it && (it.caption || it.image);
    });
    if (!visible.length) return;
    grid.innerHTML = visible
      .map(function (g, i) {
        var bg = GALLERY_BG[i % GALLERY_BG.length];
        var img = g.image
          ? '<img src="' + esc(g.image) + '" alt="" loading="lazy" onerror="this.remove()">'
          : '';
        return (
          '<div class="g-item ' + bg + ' reveal in">' +
          img +
          '<span>' + esc(g.caption || '') + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function applyEditorData(data) {
    if (!data || typeof data !== 'object') return;

    Object.keys(TEXT).forEach(function (path) {
      var v = get(data, path);
      if (v === undefined) return;
      setAll('[data-ev="' + TEXT[path] + '"]', function (el) {
        el.textContent = v == null ? '' : String(v);
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
      if (!v) return;
      setAll('[data-ev-img="' + IMG[path] + '"]', function (el) {
        el.src = String(v);
        el.style.display = '';
      });
    });

    // Venue map + directions.
    var mapEmbed = get(data, 'venue.mapEmbed');
    if (mapEmbed) setAll('[data-ev-map]', function (el) { el.src = String(mapEmbed); });
    var dirUrl = get(data, 'venue.directionsUrl');
    if (dirUrl) setAll('[data-ev-href="directionsUrl"]', function (el) { el.href = String(dirUrl); });

    // Countdown target: combine date + time (local).
    var cd = data.countdown || {};
    if (cd.targetDate && typeof window.__setWeddingTarget === 'function') {
      var t = String(cd.targetTime || '19:00');
      var when = new Date(String(cd.targetDate) + 'T' + (t.length === 5 ? t : '19:00') + ':00');
      if (!isNaN(when.getTime())) window.__setWeddingTarget(when.getTime());
    }

    rebuildEvents((data.events && data.events.items) || null);
    rebuildGallery((data.gallery && data.gallery.items) || null);
  }

  window.addEventListener('message', function (e) {
    if (e && e.data && e.data.channel === UPDATE && e.data.version === VERSION) {
      applyEditorData(e.data.data);
    }
  });

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: READY, version: VERSION }, '*');
    }
  } catch (_) {}
})();
