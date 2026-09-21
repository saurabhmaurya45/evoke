/*
 * Evoke — keeps long couple names from breaking a template's layout.
 *
 * Every template lays its names out for a "normal" length. When a user types a very long name
 * (or one long unbroken word) the text is wider than the screen and pushes the whole design out
 * of shape. This shrinks just the font size of the elements showing a name, until the widest
 * unbreakable piece fits the viewport. Short names are never touched.
 *
 * It learns the names from the same `evoke:preview-update` message every template already gets
 * (editor preview and published page alike), then re-checks on resize and on a slow timer
 * because templates render / animate their names at different moments. Shared by all templates
 * — keep it dependency-free and defensive.
 */
(function () {
  if (window.__evokeFit) return;
  window.__evokeFit = true;

  var CHANNEL = 'evoke:preview-update';
  var MIN_FONT_PX = 11;
  var VIEWPORT_SHARE = 0.9; // widest word may use up to 90% of the viewport
  var SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS|SVG|PATH|OPTION|TEXTAREA|INPUT|SELECT|HEAD|META|LINK|TITLE|HTML|BODY)$/;
  var NAME_KEY = /name/i;
  var COUPLE_KEY = /(groom|bride|couple)/i;
  var NOT_A_NAME_KEY = /(parent|family|place|prefix|father|mother|label|heading|title|caption)/i;

  var names = [];
  var scheduled = false;

  function collect(node, out, depth) {
    if (!node || typeof node !== 'object' || depth > 5) return;
    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (typeof value === 'string') {
        var text = value.replace(/\s+/g, ' ').trim().toLowerCase();
        if (text.length >= 3 && NAME_KEY.test(key) && COUPLE_KEY.test(key) && !NOT_A_NAME_KEY.test(key)) {
          out.push(text);
        }
      } else if (value && typeof value === 'object') {
        collect(value, out, depth + 1);
      }
    });
  }

  function containsName(text) {
    for (var i = 0; i < names.length; i++) {
      if (text.indexOf(names[i]) !== -1) return true;
    }
    return false;
  }

  /** The innermost elements whose text holds a couple name. */
  function targets() {
    var found = [];
    if (!names.length || !document.body) return found;
    var all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (SKIP_TAGS.test(el.tagName.toUpperCase())) continue;
      var text = el.textContent;
      if (!text || text.length > 400) continue;
      if (!containsName(text.replace(/\s+/g, ' ').toLowerCase())) continue;
      var deeper = false;
      for (var c = 0; c < el.children.length; c++) {
        if (containsName(el.children[c].textContent.replace(/\s+/g, ' ').toLowerCase())) {
          deeper = true;
          break;
        }
      }
      if (!deeper) found.push(el);
    }
    return found;
  }

  /** Width of the widest unbreakable piece of `el`'s text at font size `px`. */
  function widest(el, cs, px, wholeLine) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    var parts = wholeLine ? [text] : text.split(' ');
    var probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;padding:0;margin:0;border:0;';
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStyle = cs.fontStyle;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.textTransform = cs.textTransform;
    probe.style.fontSize = px + 'px';
    document.body.appendChild(probe);
    var width = 0;
    for (var i = 0; i < parts.length; i++) {
      probe.textContent = parts[i];
      width = Math.max(width, probe.getBoundingClientRect().width);
    }
    document.body.removeChild(probe);
    return width;
  }

  function fit(el) {
    if (el.__evokeFitted) {
      el.style.removeProperty('font-size');
      el.style.removeProperty('white-space');
      el.style.removeProperty('overflow-wrap');
      el.style.removeProperty('word-break');
      el.__evokeFitted = false;
    }
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none') return;
    var px = parseFloat(cs.fontSize);
    if (!px) return;
    var available = (document.documentElement.clientWidth || window.innerWidth) * VIEWPORT_SHARE;
    var wholeLine = /^(nowrap|pre)$/.test(cs.whiteSpace);
    var need = widest(el, cs, px, wholeLine);

    for (var pass = 0; pass < 4 && need > available && need > 0; pass++) {
      px = Math.max(MIN_FONT_PX, (px * available) / need * 0.98);
      el.style.setProperty('font-size', px + 'px', 'important');
      el.__evokeFitted = true;
      cs = window.getComputedStyle(el);
      need = widest(el, cs, px, wholeLine);
      if (px <= MIN_FONT_PX) break;
    }

    // A single unbroken "word" (no real name, but garbage/pathological input) can still be
    // wider than the viewport at the smallest readable size. Shrinking has a floor; wrapping
    // doesn't — let it break onto multiple lines as the last resort so it never forces the
    // page to scroll sideways. Only kicks in once shrinking alone couldn't make it fit.
    if (need > available) {
      el.style.setProperty('white-space', 'normal', 'important');
      el.style.setProperty('overflow-wrap', 'anywhere', 'important');
      el.style.setProperty('word-break', 'break-word', 'important');
      el.__evokeFitted = true;
    }
  }

  function run() {
    scheduled = false;
    try {
      var list = targets();
      for (var i = 0; i < list.length; i++) fit(list[i]);
    } catch (_) {
      /* never let a layout helper break the invitation */
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(run, 60);
  }

  window.addEventListener('message', function (event) {
    var message = event && event.data;
    if (!message || message.channel !== CHANNEL || !message.data) return;
    var next = [];
    collect(message.data, next, 0);
    names = next;
    schedule();
    // Templates apply the new text asynchronously; check again once they have.
    window.setTimeout(run, 400);
  });
  window.addEventListener('resize', schedule);
  window.setInterval(run, 800);
})();
