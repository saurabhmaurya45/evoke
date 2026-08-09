/**
 * Wedding T2: envelope Save the Date cover + scrollable pastel invitation.
 */
(function () {
  'use strict';

  var body = document.body;
  if (!body) return;

  var sessionCover = document.getElementById('wed2-session-cover');
  var sessionInvite = document.getElementById('wed2-session-invite');
  var hero = document.getElementById('wed2-hero');
  var cover = document.getElementById('wed2-cover');
  var envelope = document.getElementById('wed2-envelope');
  var tassel = document.getElementById('wed2-tassel');
  var saveDateBtn = document.getElementById('wed2-save-date-btn');
  var audio = document.getElementById('wed2-music');
  var muteBtn = document.getElementById('wed2-mute-btn');
  var mapIframe = document.getElementById('wed2-map-iframe');
  var mapFrame = document.getElementById('wed2-map-frame');
  var scratchCanvas = document.getElementById('wed2-scratch-canvas');
  var scratchCard = document.getElementById('wed2-scratch-card');
  var scrollPanel = document.getElementById('wed2-scroll-panel');
  var revealBtn = document.getElementById('wed2-reveal-btn');

  var countdownEls = {
    days: document.getElementById('wed2-days'),
    hours: document.getElementById('wed2-hours'),
    minutes: document.getElementById('wed2-minutes'),
    seconds: document.getElementById('wed2-seconds')
  };

  var coverOpening = false;
  var musicGesturePrimed = false;
  var mapLoaded = false;
  var nikahMapLoaded = false;
  var walimaMapLoaded = false;
  var scrollRevealsInit = false;
  var scratchInit = false;
  var polaroidThreadRaf = null;
  var openingLoader = document.getElementById('wed2-opening-loader');
  var openingLoaderFill = document.getElementById('wed2-opening-loader-fill');
  var openingLoaderTimer = null;
  var openingLoaderProgress = 0;
  var openingLoaderDone = false;
  var openingLoaderEnabled = body.getAttribute('data-opening-loader') === 'true' && !!openingLoader;

  var SONG_MUSLIM = { src: 'assets/audio/eid_song.mp3' };
  var SONG_GENERAL = { src: 'assets/audio/wedding-t1-song.mp3' };
  var COPY_MUSLIM = {
    quote: 'And among His signs is that He created for you mates from among yourselves, that you may dwell in tranquility with them, and He has put love and mercy between your hearts.',
    invitationMessage: 'With hearts full of joy, we request the honor of your presence as we begin our journey together. Your blessings and company would mean the world to us on this blessed day.',
    event1Title: 'Nikkah Ceremony'
  };
  var COPY_GENERAL = {
    quote: 'May our union be blessed with love, harmony and everlasting happiness as we begin our journey together.',
    invitationMessage: 'With hearts full of joy, we cordially invite you to grace our wedding celebrations and bless us as we begin our new chapter together.',
    event1Title: 'Wedding Ceremony'
  };
  var polaroidThreadsInit = false;
  var heroScrollLocked = false;
  var heroScrollUnlockTimer = null;
  var scrollLockHandler = null;
  var petalsStarted = false;
  var scrollHintEl = null;
  var scrollHintDismissed = false;
  var PETAL_COUNT = 9;
  var PETAL_SHADES = [
    '#fde8ec',
    '#f8d0d8',
    '#f0b4c0',
    '#e8a0ad',
    '#d98595',
    '#c96b7e',
    '#b8556a',
    '#a84355',
    '#9a3d50'
  ];

  function getAttr(name, fallback) {
    var val = body.getAttribute(name);
    if (val === null || val === '') return fallback;
    return val;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function formatParentsName(value) {
    if (!value) return '';
    if (value.indexOf('|') === -1) return value;
    return value.split('|').map(function (line) {
      return line.trim();
    }).join('<br>');
  }

  function formatLongDate(dateRaw, omitYear) {
    if (!dateRaw) return '';
    var eventDate = new Date(dateRaw + 'T00:00:00');
    if (isNaN(eventDate.getTime())) return '';
    var opts = {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    };
    if (!omitYear) opts.year = 'numeric';
    return eventDate.toLocaleDateString('en-GB', opts);
  }

  function formatScratchWeekdayDay(dateRaw) {
    if (!dateRaw) return '';
    var eventDate = new Date(dateRaw + 'T00:00:00');
    if (isNaN(eventDate.getTime())) return '';
    return eventDate.toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + eventDate.getDate();
  }

  function getEventDateRaw(slot) {
    return getAttr('data-event-' + slot + '-date', '') || getAttr('data-event-date', '');
  }

  function hasPerEventDates() {
    return !!getAttr('data-event-1-date', '') || !!getAttr('data-event-2-date', '');
  }

  function buildScheduleLine(slot, defaultTitle, includeDate, omitYear) {
    var title = getAttr('data-event-' + slot + '-title', defaultTitle);
    var time = getAttr('data-event-' + slot + '-time', '');
    if (includeDate) {
      var dateStr = formatLongDate(getEventDateRaw(slot), omitYear);
      if (dateStr && time) return title + ' — ' + dateStr + ' — ' + time;
      if (dateStr) return title + ' — ' + dateStr;
    }
    if (time) return title + ' — ' + time;
    return title;
  }

  function buildScratchScheduleLine(slot, defaultTitle, includeDate) {
    var title = getAttr('data-event-' + slot + '-title', defaultTitle);
    var time = getAttr('data-event-' + slot + '-time', '');
    var line = title;
    if (includeDate) {
      var dateStr = formatLongDate(getEventDateRaw(slot), true);
      if (dateStr) line += ' — ' + dateStr;
    }
    if (time) {
      var timeDisplay = time.replace(/ - /g, '\u00a0-\u00a0');
      line += ' — <span class="wed2-scratch-schedule-time">' + timeDisplay + '</span>';
    }
    return line;
  }

  function buildDetailsScheduleLine(slot, defaultTitle, includeDate) {
    var title = getAttr('data-event-' + slot + '-title', defaultTitle);
    var time = getAttr('data-event-' + slot + '-time', '');
    var line = title;
    if (includeDate) {
      var dateStr = formatLongDate(getEventDateRaw(slot), false);
      if (dateStr) line += ' — ' + dateStr;
    }
    if (time) {
      var timeDisplay = time.replace(/ - /g, '\u00a0-\u00a0');
      line += ' — <span class="wed2-details-schedule-time">' + timeDisplay + '</span>';
    }
    return line;
  }

  function buildDetailsScheduleLineNoTitle(slot, includeDate) {
    var time = getAttr('data-event-' + slot + '-time', '');
    var parts = [];
    if (includeDate) {
      var dateStr = formatLongDate(getEventDateRaw(slot), false);
      if (dateStr) parts.push(dateStr);
    }
    if (time) {
      parts.push(time.replace(/ - /g, '\u00a0-\u00a0'));
    }
    return parts.join(' — ');
  }

  function buildTimelineTimeDisplay(dateRaw, time) {
    var timePart = time;
    if (time && body.classList.contains('wed2-details-time-single-line')) {
      timePart =
        '<span class="wed2-timeline-schedule-time">' +
        time.replace(/ - /g, '\u00a0-\u00a0') +
        '</span>';
    }
    if (dateRaw) {
      var dateStr = formatLongDate(dateRaw);
      return time ? dateStr + ' — ' + timePart : dateStr;
    }
    return timePart || '';
  }

  function applyBrideFirstOrder() {
    if (getAttr('data-bride-first', '') !== 'true') return;
    body.classList.add('wed2-bride-first');

    var couple = document.querySelector('.wed2-details-couple');
    var groomArticle = document.getElementById('wed2-details-groom-name');
    groomArticle = groomArticle && groomArticle.closest('.wed2-details-person');
    var brideArticle = document.getElementById('wed2-details-bride-name');
    brideArticle = brideArticle && brideArticle.closest('.wed2-details-person');
    if (couple && groomArticle && brideArticle && brideArticle !== couple.firstElementChild) {
      couple.insertBefore(brideArticle, groomArticle);
    }
  }

  function hydrateDualMaps() {
    var nikahAddr = getAttr('data-nikah-venue', '');
    var walimaAddr = getAttr('data-reception-venue', '');
    setText('wed2-nikah-address-text', nikahAddr);
    setText('wed2-walima-address-text', walimaAddr);

    var nikahLinkEl = document.getElementById('wed2-nikah-map-link');
    if (nikahLinkEl) nikahLinkEl.href = getAttr('data-nikah-map-link', '#');

    var walimaLinkEl = document.getElementById('wed2-walima-map-link');
    if (walimaLinkEl) walimaLinkEl.href = getAttr('data-walima-map-link', '#');
  }

  function resetScrollToTop() {
    var scrollPage = document.getElementById('wed2-scroll-page');
    if (scrollPage) scrollPage.scrollTop = 0;
    if (window.scrollTo) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    if (sessionInvite) sessionInvite.scrollTop = 0;
  }

  function showSession(target) {
    if (target === sessionInvite && sessionInvite) {
      sessionInvite.classList.add('is-active');
      sessionInvite.removeAttribute('aria-hidden');
    } else {
      var sessions = [sessionCover, sessionInvite];
      sessions.forEach(function (node) {
        if (!node) return;
        var isTarget = node === target;
        node.classList.toggle('is-active', isTarget);
        if (isTarget) node.removeAttribute('aria-hidden');
        else node.setAttribute('aria-hidden', 'true');
      });
    }

    if (target === sessionInvite) {
      resetScrollToTop();
      if (!scrollRevealsInit) {
        initScrollReveals();
        scrollRevealsInit = true;
      }
      if (!scratchInit) {
        initScratchCard();
        scratchInit = true;
      }
      requestAnimationFrame(function () {
        resetScrollToTop();
      });
    }
  }

  var TASSEL_OPEN_RATIO = 0.3;

  function getViewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  var FLORAL_ANIM_DELAY_MS = 700;
  var FLORAL_ANIM_DURATION_MS = 1750;
  var BISMILLAH_INTRO_DELAY_MS = FLORAL_ANIM_DELAY_MS + 1000;
  var BISMILLAH_ANIM_DURATION_MS = 950;
  var HERO_VERSE_DISPLAY_MS = 1100;
  var RING_ANIM_DURATION_MS = 1000;
  var RING_NAMES_ANIM_MS = 1200;
  var HERO_SCROLL_UNLOCK_BUFFER_MS = 250;

  function getHeroScrollUnlockMs() {
    var total =
      BISMILLAH_INTRO_DELAY_MS +
      (hasBismillahIntro() ? BISMILLAH_ANIM_DURATION_MS : 0) +
      Math.round(RING_ANIM_DURATION_MS * 0.45) +
      RING_NAMES_ANIM_MS +
      HERO_SCROLL_UNLOCK_BUFFER_MS;
    if (body.classList.contains('wed2-has-hero-verse')) {
      total += HERO_VERSE_DISPLAY_MS;
    }
    return total;
  }

  function hasBismillahIntro() {
    return !body.classList.contains('wed2-general') && !body.classList.contains('wed2-hindu');
  }

  function onScrollLockEvent(e) {
    if (!heroScrollLocked) return;
    resetScrollToTop();
    e.preventDefault();
  }

  function lockInviteScroll() {
    if (!sessionInvite || heroScrollLocked) return;
    heroScrollLocked = true;
    sessionInvite.classList.add('is-scroll-locked');
    resetScrollToTop();

    if (!scrollLockHandler) {
      scrollLockHandler = onScrollLockEvent;
      sessionInvite.addEventListener('wheel', scrollLockHandler, { passive: false });
      sessionInvite.addEventListener('touchmove', scrollLockHandler, { passive: false });
    }
  }

  function unlockInviteScroll() {
    if (!sessionInvite) return;
    heroScrollLocked = false;
    sessionInvite.classList.remove('is-scroll-locked');

    if (scrollLockHandler) {
      sessionInvite.removeEventListener('wheel', scrollLockHandler);
      sessionInvite.removeEventListener('touchmove', scrollLockHandler);
      scrollLockHandler = null;
    }

    startRosePetals();
    showHeroScrollHint();
  }

  function showHeroScrollHint() {
    if (!scrollHintEl || scrollHintDismissed) return;
    scrollHintEl.classList.add('is-visible');
  }

  function dismissHeroScrollHint() {
    if (!scrollHintEl || scrollHintDismissed) return;
    scrollHintDismissed = true;
    scrollHintEl.classList.remove('is-visible');
    scrollHintEl.classList.add('is-hidden');
  }

  function initHeroScrollHint() {
    if (getAttr('data-hero-scroll-hint', 'true') === 'false' || !hero) return;

    scrollHintEl = document.createElement('div');
    scrollHintEl.className = 'wed2-scroll-hint';
    scrollHintEl.id = 'wed2-scroll-hint';
    scrollHintEl.setAttribute('aria-hidden', 'true');
    scrollHintEl.innerHTML =
      '<span class="wed2-scroll-hint-chevrons" aria-hidden="true">' +
      '<span></span><span></span></span>' +
      '<span class="wed2-scroll-hint-label">Scroll up</span>';
    hero.appendChild(scrollHintEl);

    if (sessionInvite) {
      sessionInvite.addEventListener('scroll', function () {
        if (sessionInvite.scrollTop > 24) dismissHeroScrollHint();
      }, { passive: true });
    }
  }

  function applyCoverMonogram() {
    var monogram = getAttr('data-cover-monogram', '');
    if (!monogram) return;

    var monogramWrap = document.querySelector('.wed2-seal-monogram');
    var sealBtn = document.getElementById('wed2-save-date-btn');
    if (monogramWrap) {
      monogramWrap.innerHTML = '<span class="wed2-seal-initials">' + monogram + '</span>';
    }
    if (sealBtn) sealBtn.classList.add('is-initials');
  }

  function applyScratchSectionTitle() {
    var title = getAttr('data-scratch-section-title', '');
    if (!title) return;

    var scratchSection = document.getElementById('wed2-scratch-section');
    var titleEl = scratchSection && scratchSection.querySelector('.wed2-section-title');
    if (titleEl) titleEl.textContent = title;
  }

  function createRosePetal(container, index) {
    var petal = document.createElement('span');
    petal.className = 'wed2-petal';

    var left = 4 + Math.random() * 92;
    var duration = 18 + Math.random() * 12;
    var delay = -(Math.random() * duration);
    var drift = (Math.random() - 0.5) * 90;
    var spin = 220 + Math.random() * 420;
    var size = 9 + Math.random() * 8;
    var shade = PETAL_SHADES[index % PETAL_SHADES.length];

    petal.style.left = left + '%';
    petal.style.width = size + 'px';
    petal.style.height = (size * 1.18) + 'px';
    petal.style.background = shade;
    petal.style.setProperty('--petal-drift', drift.toFixed(1) + 'px');
    petal.style.setProperty('--petal-spin', spin.toFixed(0) + 'deg');
    petal.style.setProperty('--petal-opacity', (0.42 + Math.random() * 0.38).toFixed(2));
    petal.style.animationDuration = duration.toFixed(1) + 's';
    petal.style.animationDelay = delay.toFixed(1) + 's';

    container.appendChild(petal);
  }

  function startRosePetals() {
    if (petalsStarted) return;
    var container = document.getElementById('wed2-petals');
    if (!container) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    petalsStarted = true;
    container.classList.add('is-active');

    for (var i = 0; i < PETAL_COUNT; i++) {
      createRosePetal(container, i);
    }
  }

  function scheduleHeroScrollUnlock() {
    if (heroScrollUnlockTimer) {
      clearTimeout(heroScrollUnlockTimer);
      heroScrollUnlockTimer = null;
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      unlockInviteScroll();
      return;
    }

    heroScrollUnlockTimer = setTimeout(function () {
      heroScrollUnlockTimer = null;
      unlockInviteScroll();
    }, getHeroScrollUnlockMs());
  }

  function runHeroFloralReveal() {
    if (!hero) {
      unlockInviteScroll();
      return;
    }
    lockInviteScroll();
    hero.classList.add('is-floral-revealed');
    scheduleHeroScrollUnlock();
    setTimeout(runHeroBismillahIntro, BISMILLAH_INTRO_DELAY_MS);
  }

  function runHeroBismillahIntro() {
    if (!hero) return;

    if (!hasBismillahIntro()) {
      runHeroRingIntro();
      return;
    }

    hero.classList.add('is-intro-active');
    if (body.classList.contains('wed2-has-hero-verse')) {
      setTimeout(function () {
        if (!hero) return;
        hero.classList.add('is-verse-active');
        setTimeout(runHeroRingIntro, HERO_VERSE_DISPLAY_MS);
      }, BISMILLAH_ANIM_DURATION_MS);
      return;
    }
    setTimeout(runHeroRingIntro, BISMILLAH_ANIM_DURATION_MS);
  }

  function runHeroRingIntro() {
    if (!hero) return;
    hero.classList.add('is-ring-active');
    setTimeout(function () {
      hero.classList.add('is-names-active');
    }, Math.round(RING_ANIM_DURATION_MS * 0.45));
  }

  function openInvitation() {
    if (coverOpening) return;
    coverOpening = true;

    if (envelope) envelope.classList.add('is-open');
    if (saveDateBtn) saveDateBtn.classList.add('is-falling');
    if (tassel) {
      tassel.classList.remove('is-dragging', 'is-near-open');
      tassel.classList.add('is-opening');
    }

    startMusic();

    setTimeout(function () {
      if (cover) cover.classList.add('is-fading');
      if (sessionCover) sessionCover.classList.add('is-fading');
      showSession(sessionInvite);
      runHeroFloralReveal();
    }, 700);

    setTimeout(function () {
      if (sessionCover) {
        sessionCover.classList.remove('is-active', 'is-fading');
        sessionCover.setAttribute('aria-hidden', 'true');
      }
    }, 1500);
  }

  function resetTasselPull() {
    if (!tassel) return;
    tassel.style.setProperty('--tassel-pull', '0px');
    tassel.classList.remove('is-dragging', 'is-near-open');
  }

  function initTasselPull() {
    if (!tassel) return;

    var dragging = false;
    var startY = 0;
    var pullY = 0;
    var activePointerId = null;

    function getClientY(e) {
      if (e.touches && e.touches.length) return e.touches[0].clientY;
      return e.clientY;
    }

    function getOpenThresholdY() {
      return getViewportHeight() * TASSEL_OPEN_RATIO;
    }

    function updatePull(nextPull) {
      pullY = Math.max(0, nextPull);
      tassel.style.setProperty('--tassel-pull', pullY + 'px');

      var rect = tassel.getBoundingClientRect();
      var nearOpen = rect.bottom >= getOpenThresholdY();
      tassel.classList.toggle('is-near-open', nearOpen);

      if (nearOpen) {
        openInvitation();
        endDrag(true);
      }
    }

    function endDrag(skipSnap) {
      dragging = false;
      activePointerId = null;
      if (coverOpening) return;
      if (!skipSnap) resetTasselPull();
    }

    function onPointerDown(e) {
      if (coverOpening) return;
      if (e.button !== undefined && e.button !== 0) return;

      primeMusicGesture();

      dragging = true;
      activePointerId = e.pointerId;
      startY = getClientY(e);
      pullY = 0;
      tassel.classList.add('is-dragging');

      if (tassel.setPointerCapture) {
        try {
          tassel.setPointerCapture(e.pointerId);
        } catch (err) {
          /* no-op */
        }
      }

      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointerId) return;

      var dy = getClientY(e) - startY;
      if (dy > 0) updatePull(dy);
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      endDrag(false);
    }

    tassel.addEventListener('pointerdown', onPointerDown);
    tassel.addEventListener('pointermove', onPointerMove);
    tassel.addEventListener('pointerup', onPointerUp);
    tassel.addEventListener('pointercancel', onPointerUp);

    tassel.addEventListener('keydown', function (e) {
      if (coverOpening) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInvitation();
      }
    });
  }

  function initCoverOpener() {
    if (saveDateBtn) {
      saveDateBtn.addEventListener('click', openInvitation);
    }
    initTasselPull();
  }

  function applyMusicVolume() {
    if (!audio) return;
    var volRaw = getAttr('data-music-volume', '');
    if (!volRaw) return;
    var vol = parseFloat(volRaw);
    if (isNaN(vol)) return;
    if (vol > 1) vol = vol / 100;
    audio.volume = Math.min(1, Math.max(0, vol));
  }

  function initializeAudio() {
    if (!audio) return;
    applyMusicVolume();
  }

  function setAudioSource(song) {
    if (!audio || !song || !song.src) return;
    var source = audio.querySelector('source');
    if (!source) return;
    source.src = song.src;
    audio.load();
  }

  function applyStyleChoice(style) {
    var isGeneral = style === 'general';
    body.classList.toggle('wed2-general', isGeneral);

    var copy = isGeneral ? COPY_GENERAL : COPY_MUSLIM;
    body.setAttribute('data-quote', copy.quote);
    body.setAttribute('data-invitation-message', copy.invitationMessage);
    body.setAttribute('data-event-1-title', copy.event1Title);

    if (isGeneral) {
      body.setAttribute('data-groom-name', 'James');
      body.setAttribute('data-bride-name', 'Serin');
      body.removeAttribute('data-groom-display-name');
      body.removeAttribute('data-bride-display-name');
      document.title = 'James & Serin — Wedding Invitation';
    } else {
      body.setAttribute('data-groom-name', 'Ahmed');
      body.setAttribute('data-bride-name', 'Fatima');
      body.removeAttribute('data-groom-display-name');
      body.removeAttribute('data-bride-display-name');
      document.title = 'Ahmed & Fatima — Wedding Invitation';
    }

    setAudioSource(isGeneral ? SONG_GENERAL : SONG_MUSLIM);
    hydrate();
  }

  function showMuteButton(show) {
    if (!muteBtn) return;
    muteBtn.classList.toggle('is-visible', show);
    if (show) muteBtn.removeAttribute('aria-hidden');
    else muteBtn.setAttribute('aria-hidden', 'true');
  }

  function primeMusicGesture() {
    if (!audio || musicGesturePrimed) return;
    musicGesturePrimed = true;
    applyMusicVolume();

    var wasMuted = audio.muted;
    audio.muted = true;
    var playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== 'function') {
      audio.muted = wasMuted;
      return;
    }

    playPromise.then(function () {
      if (!coverOpening) {
        audio.pause();
        audio.currentTime = 0;
      }
      audio.muted = wasMuted;
    }).catch(function () {
      audio.muted = wasMuted;
    });
  }

  function startMusic() {
    if (!audio) return;
    musicGesturePrimed = true;
    applyMusicVolume();
    audio.muted = false;
    audio.play().catch(function () {});
    showMuteButton(true);
  }

  function initMute() {
    if (!muteBtn || !audio) return;
    muteBtn.addEventListener('click', function () {
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute music' : 'Mute music');
    });
  }

  function hydrateTimeline() {
    if (getAttr('data-timeline-custom', '') === 'true') return;

    for (var i = 1; i <= 4; i++) {
      var title = getAttr('data-event-' + i + '-title', '');
      var time = getAttr('data-event-' + i + '-time', '');
      var dateRaw = getAttr('data-event-' + i + '-date', '');
      var timeDisplay = time;

      if (dateRaw) {
        var dateStr = formatLongDate(dateRaw);
        timeDisplay = dateStr + (time ? ' — ' + time : '');
      }

      setText('wed2-event-' + i + '-title', title);
      if (body.classList.contains('wed2-details-time-single-line') && (time || dateRaw)) {
        setHtml('wed2-event-' + i + '-time', buildTimelineTimeDisplay(dateRaw, time));
      } else {
        setText('wed2-event-' + i + '-time', timeDisplay);
      }

      var item = document.querySelector('.wed2-timeline-item[data-slot="' + i + '"]');
      if (item) {
        if (!title && !time && !dateRaw) {
          item.classList.add('is-hidden');
        } else {
          item.classList.remove('is-hidden');
        }
      }
    }
  }

  function hydratePolaroids() {
    var countRaw = parseInt(getAttr('data-polaroid-count', '4'), 10);
    var count = isNaN(countRaw) ? 4 : Math.min(4, Math.max(0, countRaw));

    for (var i = 1; i <= 4; i++) {
      var hang = document.querySelector('.wed2-polaroid-hang[data-slot="' + i + '"]');
      if (!hang) continue;

      if (i > count) {
        hang.classList.add('is-hidden');
        continue;
      }

      hang.classList.remove('is-hidden');
      setText('wed2-polaroid-' + i + '-caption', getAttr('data-polaroid-' + i + '-caption', ''));
    }

    var row = document.getElementById('wed2-polaroid-row');
    if (row && count === 0) row.classList.add('is-hidden');
    else if (row) row.classList.remove('is-hidden');

    updatePolaroidThreads();
  }

  function ensureThreadGradient(svg) {
    if (!svg || svg.querySelector('#wed2-thread-gradient')) return;
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'wed2-thread-gradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', '1');

    var stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopA.setAttribute('offset', '0%');
    stopA.setAttribute('stop-color', '#7a1f38');
    var stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopB.setAttribute('offset', '100%');
    stopB.setAttribute('stop-color', '#5a1528');

    gradient.appendChild(stopA);
    gradient.appendChild(stopB);
    defs.appendChild(gradient);
    svg.appendChild(defs);
  }

  function updatePolaroidThreads() {
    var stage = document.getElementById('wed2-counter-stage');
    var svg = document.getElementById('wed2-polaroid-threads');
    if (!stage || !svg) return;

    var hangs = stage.querySelectorAll('.wed2-polaroid-hang:not(.is-hidden)');
    var stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !hangs.length) {
      svg.querySelectorAll('.wed2-polaroid-thread-line').forEach(function (line) { line.remove(); });
      return;
    }

    svg.setAttribute('width', String(stageRect.width));
    svg.setAttribute('height', String(stageRect.height));
    svg.setAttribute('viewBox', '0 0 ' + stageRect.width + ' ' + stageRect.height);
    ensureThreadGradient(svg);

    svg.querySelectorAll('.wed2-polaroid-thread-line').forEach(function (line) { line.remove(); });

    hangs.forEach(function (hang) {
      var counterId = hang.getAttribute('data-counter-id');
      var counter = counterId ? document.getElementById(counterId) : null;
      var swing = hang.querySelector('.wed2-polaroid-swing');
      if (!counter || !swing) return;

      var counterRect = counter.getBoundingClientRect();
      var swingRect = swing.getBoundingClientRect();
      var x0 = counterRect.left + counterRect.width / 2 - stageRect.left;
      var y0 = counterRect.bottom - stageRect.top - 2;
      var x1 = swingRect.left + swingRect.width / 2 - stageRect.left;
      var y1 = swingRect.top - stageRect.top + 2;

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'wed2-polaroid-thread-line');
      line.setAttribute('x1', String(x0));
      line.setAttribute('y1', String(y0));
      line.setAttribute('x2', String(x1));
      line.setAttribute('y2', String(y1));
      svg.appendChild(line);
    });
  }

  function stopPolaroidThreadLoop() {
    if (polaroidThreadRaf) {
      cancelAnimationFrame(polaroidThreadRaf);
      polaroidThreadRaf = null;
    }
  }

  function startPolaroidThreadLoop() {
    stopPolaroidThreadLoop();
    function loop() {
      var countdown = document.getElementById('wed2-countdown-section');
      if (!countdown || !countdown.classList.contains('is-swinging')) {
        polaroidThreadRaf = null;
        return;
      }
      updatePolaroidThreads();
      polaroidThreadRaf = requestAnimationFrame(loop);
    }
    polaroidThreadRaf = requestAnimationFrame(loop);
  }

  function startPolaroidSwing(countdownEl) {
    if (!countdownEl) return;
    updatePolaroidThreads();

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    setTimeout(function () {
      countdownEl.classList.add('is-swinging');
      startPolaroidThreadLoop();
    }, 900);
  }

  function initPolaroidThreads() {
    if (polaroidThreadsInit) return;
    polaroidThreadsInit = true;

    window.addEventListener('resize', updatePolaroidThreads);
    document.querySelectorAll('.wed2-polaroid-img img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', updatePolaroidThreads);
      }
    });
  }

  function onCountdownRevealed(countdownEl) {
    updatePolaroidThreads();
    startPolaroidSwing(countdownEl);
  }

  function hydrate() {
    var groomName = getAttr('data-groom-name', '');
    var brideName = getAttr('data-bride-name', '');
    var groomDisplay = getAttr('data-groom-display-name', groomName);
    var brideDisplay = getAttr('data-bride-display-name', brideName);
    var sharedParentPrefix = getAttr('data-parent-prefix', '');
    var sharedParentsName = getAttr('data-parents-name', '');

    setText('wed2-quote-text', getAttr('data-quote', ''));
    setText('wed2-invitation-message', getAttr('data-invitation-message', ''));
    setText('wed2-groom-name', groomDisplay);
    setText('wed2-bride-name', brideDisplay);
    setText('wed2-details-groom-name', groomName);
    setText('wed2-details-bride-name', brideName);
    setText('wed2-details-groom-prefix', getAttr('data-groom-parent-prefix', sharedParentPrefix));
    setHtml('wed2-details-groom-parents', formatParentsName(getAttr('data-groom-parents-name', sharedParentsName)));
    setText('wed2-details-bride-prefix', getAttr('data-bride-parent-prefix', sharedParentPrefix));
    setHtml('wed2-details-bride-parents', formatParentsName(getAttr('data-bride-parents-name', sharedParentsName)));

    var eventTime = getAttr('data-event-time', '11:00 AM - 6:00 PM');
    var nikahVenue = getAttr('data-nikah-venue', '');
    var receptionVenue = getAttr('data-reception-venue', '');
    var splitDetails =
      body.getAttribute('data-details-split-schedule') === 'true' ||
      (nikahVenue && receptionVenue);

    var schedule1 = '';
    var schedule2 = '';
    var scratchNikahOnly = body.getAttribute('data-scratch-nikah-only') === 'true';
    var scratchReceptionOnly = body.getAttribute('data-scratch-reception-only') === 'true';
    var scratchTimeOnly = body.getAttribute('data-scratch-time-only') === 'true';
    var detailsReceptionOnly = body.getAttribute('data-details-reception-only') === 'true';
    if (splitDetails) {
      var includeDateInSchedule = hasPerEventDates();
      schedule1 = buildScheduleLine(1, 'Nikah', includeDateInSchedule);
      schedule2 = buildScheduleLine(2, 'Reception', includeDateInSchedule);
      var detailsSchedule1 = schedule1;
      var detailsSchedule2 = schedule2;
      if (body.classList.contains('wed2-details-time-single-line') && includeDateInSchedule) {
        detailsSchedule1 = buildDetailsScheduleLine(1, 'Nikah', true);
        detailsSchedule2 = buildDetailsScheduleLine(2, 'Reception', true);
      }
      if (detailsReceptionOnly) {
        detailsSchedule2 = buildDetailsScheduleLineNoTitle(2, includeDateInSchedule);
      }
      if (scratchNikahOnly) {
        setText('wed2-scratch-time', getAttr('data-event-1-time', ''));
      } else if (scratchReceptionOnly) {
        if (scratchTimeOnly) {
          setText('wed2-scratch-time', getAttr('data-event-2-time', eventTime));
          var scratchTimeOnlyEl = document.getElementById('wed2-scratch-time');
          if (scratchTimeOnlyEl) scratchTimeOnlyEl.classList.remove('wed2-scratch-time-multiline');
        } else {
          var includeDateInReceptionScratch =
            includeDateInSchedule && body.getAttribute('data-scratch-omit-date') !== 'true';
          setHtml(
            'wed2-scratch-time',
            buildScratchScheduleLine(2, 'Reception', includeDateInReceptionScratch)
          );
          var scratchReceptionTimeEl = document.getElementById('wed2-scratch-time');
          if (scratchReceptionTimeEl) scratchReceptionTimeEl.classList.remove('wed2-scratch-time-multiline');
        }
      } else {
        var includeDateInScratch =
          includeDateInSchedule && body.getAttribute('data-scratch-omit-date') !== 'true';
        var scratchSchedule1 = buildScratchScheduleLine(1, 'Nikah', includeDateInScratch);
        var scratchSchedule2 = buildScratchScheduleLine(2, 'Reception', includeDateInScratch);
        setHtml(
          'wed2-scratch-time',
          '<span class="wed2-scratch-time-line">' + scratchSchedule1 + '</span>' +
          '<span class="wed2-scratch-time-line">' + scratchSchedule2 + '</span>'
        );
        var scratchTimeEl = document.getElementById('wed2-scratch-time');
        if (scratchTimeEl) scratchTimeEl.classList.add('wed2-scratch-time-multiline');
      }
    } else {
      setText('wed2-scratch-time', eventTime.replace(' - ', ' — '));
    }

    var scratchTimeOverride = getAttr('data-scratch-time', '');
    if (scratchTimeOverride) {
      setText('wed2-scratch-time', scratchTimeOverride);
      var scratchTimeOverrideEl = document.getElementById('wed2-scratch-time');
      if (scratchTimeOverrideEl) scratchTimeOverrideEl.classList.remove('wed2-scratch-time-multiline');
    }

    var mapAddress = receptionVenue || nikahVenue || getAttr('data-event-address', '');
    if (!document.getElementById('wed2-nikah-address-text')) {
      setText('wed2-address-text', mapAddress);
    }

    if (nikahVenue && receptionVenue) {
      setHtml(
        'wed2-details-venue',
        '<span class="wed2-details-subline">' + getAttr('data-event-1-title', 'Nikah') + ' — ' + nikahVenue + '</span>' +
        '<span class="wed2-details-subline">' + getAttr('data-event-2-title', 'Reception') + ' — ' + receptionVenue + '</span>'
      );
      var venueEl = document.getElementById('wed2-details-venue');
      if (venueEl) venueEl.classList.add('wed2-details-value-multiline');
    } else {
      setText('wed2-details-venue', getAttr('data-event-address', ''));
    }

    var dateRaw = getAttr('data-event-date', '2026-08-15');
    var event1DateRaw = getAttr('data-event-1-date', '');
    var event2DateRaw = getAttr('data-event-2-date', '');
    var dualScratchDates =
      splitDetails &&
      !scratchNikahOnly &&
      !scratchReceptionOnly &&
      event1DateRaw &&
      event2DateRaw &&
      event1DateRaw !== event2DateRaw;
    var scratchDateRaw =
      getAttr('data-scratch-date', '') ||
      (scratchReceptionOnly ? event2DateRaw : '') ||
      event1DateRaw ||
      dateRaw;
    var eventDate = new Date(scratchDateRaw + 'T00:00:00');
    if (dualScratchDates || !isNaN(eventDate.getTime())) {
      var detailsDate = formatLongDate(dateRaw);
      var scratchDayEl = document.getElementById('wed2-scratch-day');

      if (dualScratchDates) {
        var scratchD1 = new Date(event1DateRaw + 'T00:00:00');
        var scratchD2 = new Date(event2DateRaw + 'T00:00:00');
        var scratchMonthLabel;

        if (
          scratchD1.getMonth() === scratchD2.getMonth() &&
          scratchD1.getFullYear() === scratchD2.getFullYear()
        ) {
          scratchMonthLabel = scratchD1.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
        } else {
          scratchMonthLabel =
            scratchD1.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase() +
            ' — ' +
            scratchD2.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
        }

        setText('wed2-scratch-month', scratchMonthLabel);
        setHtml(
          'wed2-scratch-day',
          formatScratchWeekdayDay(event1DateRaw) +
            ' <span class="wed2-scratch-day-amp">&amp;</span> ' +
            formatScratchWeekdayDay(event2DateRaw)
        );
        if (scratchDayEl) scratchDayEl.classList.add('wed2-scratch-day-dual');
        setText('wed2-scratch-year', String(scratchD2.getFullYear()));
      } else {
        setText(
          'wed2-scratch-month',
          eventDate.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
        );
        setText(
          'wed2-scratch-day',
          eventDate.toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + eventDate.getDate()
        );
        if (scratchDayEl) scratchDayEl.classList.remove('wed2-scratch-day-dual');
        setText('wed2-scratch-year', String(eventDate.getFullYear()));
      }

      if (splitDetails) {
        if (detailsReceptionOnly) {
          setText('wed2-details-datetime', detailsSchedule2);
        } else if (hasPerEventDates()) {
          setHtml(
            'wed2-details-datetime',
            '<span class="wed2-details-subline">' + detailsSchedule1 + '</span>' +
            '<span class="wed2-details-subline">' + detailsSchedule2 + '</span>'
          );
        } else {
          setHtml(
            'wed2-details-datetime',
            detailsDate + '<br>' +
            '<span class="wed2-details-subline">' + detailsSchedule1 + '</span>' +
            '<span class="wed2-details-subline">' + detailsSchedule2 + '</span>'
          );
        }
        var datetimeEl = document.getElementById('wed2-details-datetime');
        if (datetimeEl) {
          if (detailsReceptionOnly) datetimeEl.classList.remove('wed2-details-value-multiline');
          else datetimeEl.classList.add('wed2-details-value-multiline');
        }
      } else {
        setText('wed2-details-datetime', detailsDate + ' at ' + eventTime.replace(' - ', ' — '));
      }
    } else if (splitDetails) {
      if (detailsReceptionOnly) {
        setText('wed2-details-datetime', detailsSchedule2);
      } else {
        setHtml(
          'wed2-details-datetime',
          '<span class="wed2-details-subline">' + detailsSchedule1 + '</span>' +
          '<span class="wed2-details-subline">' + detailsSchedule2 + '</span>'
        );
      }
    } else {
      setText('wed2-details-datetime', eventTime.replace(' - ', ' — '));
    }

    var mapLink = document.getElementById('wed2-map-link');
    if (mapLink) mapLink.href = getAttr('data-map-link', '#');

    var coupleImg = document.getElementById('wed2-hero-couple');
    if (coupleImg) {
      coupleImg.src = getAttr('data-couple-photo', 'assets/images/red-gAndb.png');
    }

    hydrateTimeline();
    hydratePolaroids();
    applyCoverMonogram();
    applyScratchSectionTitle();
    initHeroScrollHint();
    applyBrideFirstOrder();
    hydrateDualMaps();
  }

  function initScrollReveals() {
    var sections = document.querySelectorAll('.wed2-reveal');
    if (!sections.length) return;

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
        if (el.id === 'wed2-countdown-section') onCountdownRevealed(el);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);

            if (entry.target.id === 'wed2-map-section') {
              loadMapIframe();
            }

            if (entry.target.id === 'wed2-countdown-section') {
              onCountdownRevealed(entry.target);
            }
          }
        });
      },
      { root: sessionInvite, rootMargin: '0px 0px -40px 0px', threshold: 0.12 }
    );

    sections.forEach(function (el) { observer.observe(el); });
  }

  function loadMapIframe() {
    if (!mapLoaded && mapIframe) {
      var embedUrl = getAttr('data-map-embed', '');
      if (embedUrl) {
        mapIframe.src = embedUrl;
        mapLoaded = true;
      }
    }

    var nikahIframe = document.getElementById('wed2-map-nikah-iframe');
    if (!nikahMapLoaded && nikahIframe) {
      var nikahEmbed = getAttr('data-nikah-map-embed', '');
      if (nikahEmbed) {
        nikahIframe.src = nikahEmbed;
        nikahMapLoaded = true;
      }
    }

    var walimaIframe = document.getElementById('wed2-map-walima-iframe');
    if (!walimaMapLoaded && walimaIframe) {
      var walimaEmbed = getAttr('data-walima-map-embed', '');
      if (walimaEmbed) {
        walimaIframe.src = walimaEmbed;
        walimaMapLoaded = true;
      }
    }
  }

  function drawScratchOverlay(ctx, width, height) {
    var gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0dcc8');
    gradient.addColorStop(0.32, '#ddb896');
    gradient.addColorStop(0.62, '#c9937a');
    gradient.addColorStop(1, '#a86b5e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 248, 240, 0.28)';
    for (var i = 0; i < 90; i++) {
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 3 + 1,
        Math.random() * 3 + 1
      );
    }

    ctx.fillStyle = 'rgba(107, 29, 50, 0.1)';
    for (var j = 0; j < 40; j++) {
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 2 + 0.5,
        Math.random() * 2 + 0.5
      );
    }

    ctx.font = '600 14px Nunito, sans-serif';
    ctx.fillStyle = 'rgba(107, 29, 50, 0.78)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Scratch here', width / 2, height / 2);
  }

  function initScratchCard() {
    if (!scratchCanvas || !scratchCard) return;
    var scratchSection = document.getElementById('wed2-scratch-section');
    var scratchBurst = document.getElementById('wed2-scratch-burst');

    if (body.getAttribute('data-scratch-revealed') === 'true') {
      scratchCard.classList.add('is-revealed');
      if (scratchSection) {
        scratchSection.classList.add('is-revealed-static');
        var hint = scratchSection.querySelector('.wed2-scratch-hint');
        if (hint) hint.hidden = true;
      }
      return;
    }

    var ctx = scratchCanvas.getContext('2d');
    if (!ctx) {
      if (revealBtn) {
        revealBtn.hidden = false;
        revealBtn.addEventListener('click', function () {
          scratchCard.classList.add('is-revealed');
          if (scratchSection) scratchSection.classList.add('is-splashed');
          launchScratchPoppers();
        });
      }
      return;
    }
    var isDrawing = false;
    var revealed = false;
    var brushRadius = 22;

    function resizeCanvas() {
      var measureEl = scrollPanel || scratchCard;
      var rect = measureEl.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      scratchCanvas.width = rect.width * dpr;
      scratchCanvas.height = rect.height * dpr;
      scratchCanvas.style.width = rect.width + 'px';
      scratchCanvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScratchOverlay(ctx, rect.width, rect.height);
    }

    function getPos(e) {
      var rect = scratchCanvas.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function scratch(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    function getClearedPercent() {
      var w = scratchCanvas.width;
      var h = scratchCanvas.height;
      var imageData = ctx.getImageData(0, 0, w, h);
      var pixels = imageData.data;
      var total = pixels.length / 4;
      var cleared = 0;
      var step = 8;

      for (var i = 3; i < pixels.length; i += 4 * step) {
        if (pixels[i] === 0) cleared++;
      }

      return cleared / (total / step);
    }

    function launchScratchPoppers() {
      if (!scratchBurst) return;

      scratchBurst.classList.add('is-active');
      scratchBurst.innerHTML = '';

      var colors = ['wed2-popper-red', 'wed2-popper-gold', 'wed2-popper-blush'];
      var countPerSide = 24;

      function addPiece(fromLeft) {
        var piece = document.createElement('div');
        piece.className = 'wed2-popper ' + colors[Math.floor(Math.random() * colors.length)];

        var startPercent = fromLeft
          ? (3 + Math.random() * 18)
          : (79 + Math.random() * 18);
        var driftX = fromLeft
          ? (30 + Math.random() * 120)
          : -(30 + Math.random() * 120);

        piece.style.left = startPercent.toFixed(2) + '%';
        piece.style.animationDelay = (Math.random() * 0.45).toFixed(2) + 's';
        piece.style.animationDuration = (2.9 + Math.random() * 1.9).toFixed(2) + 's';
        piece.style.width = (5 + Math.random() * 10).toFixed(2) + 'px';
        piece.style.height = (8 + Math.random() * 14).toFixed(2) + 'px';
        piece.style.setProperty('--wed2-drift-x', driftX.toFixed(2) + 'px');
        piece.style.setProperty('--wed2-twist', (Math.random() * 720 - 360).toFixed(2) + 'deg');
        scratchBurst.appendChild(piece);
      }

      for (var i = 0; i < countPerSide; i++) {
        addPiece(true);
        addPiece(false);
      }

      setTimeout(function () {
        scratchBurst.classList.remove('is-active');
        scratchBurst.innerHTML = '';
      }, 5600);
    }

    function checkReveal() {
      if (revealed) return;
      if (getClearedPercent() >= 0.42) {
        revealed = true;
        scratchCard.classList.add('is-revealed');
        if (scratchSection) scratchSection.classList.add('is-splashed');
        launchScratchPoppers();
      }
    }

    function onStart(e) {
      if (revealed) return;
      isDrawing = true;
      var pos = getPos(e);
      scratch(pos.x, pos.y);
      e.preventDefault();
    }

    function onMove(e) {
      if (!isDrawing || revealed) return;
      var pos = getPos(e);
      scratch(pos.x, pos.y);
      checkReveal();
      e.preventDefault();
    }

    function onEnd() {
      if (isDrawing) checkReveal();
      isDrawing = false;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    scratchCanvas.addEventListener('mousedown', onStart);
    scratchCanvas.addEventListener('mousemove', onMove);
    scratchCanvas.addEventListener('mouseup', onEnd);
    scratchCanvas.addEventListener('mouseleave', onEnd);
    scratchCanvas.addEventListener('touchstart', onStart, { passive: false });
    scratchCanvas.addEventListener('touchmove', onMove, { passive: false });
    scratchCanvas.addEventListener('touchend', onEnd);
  }

  function startCountdown() {
    if (!countdownEls.days) return;

    var dateRaw = getEventDateRaw(1) || getAttr('data-event-date', '2026-08-15');
    var eventTimeRaw = getAttr('data-event-1-time', '') || getAttr('data-event-time', '11:00 AM - 6:00 PM');
    var timeStart = eventTimeRaw.split('-')[0].trim();
    var dateTime = new Date(dateRaw + ' ' + timeStart);

    if (isNaN(dateTime.getTime())) {
      dateTime = new Date(dateRaw + 'T11:00:00');
    }

    function tick() {
      var now = new Date().getTime();
      var diff = dateTime.getTime() - now;

      if (diff <= 0) {
        countdownEls.days.textContent = '0';
        countdownEls.hours.textContent = '0';
        countdownEls.minutes.textContent = '0';
        countdownEls.seconds.textContent = '0';
        return;
      }

      var dayMs = 24 * 60 * 60 * 1000;
      var hourMs = 60 * 60 * 1000;
      var minuteMs = 60 * 1000;

      countdownEls.days.textContent = String(Math.floor(diff / dayMs));
      countdownEls.hours.textContent = String(Math.floor((diff % dayMs) / hourMs));
      countdownEls.minutes.textContent = String(Math.floor((diff % hourMs) / minuteMs));
      countdownEls.seconds.textContent = String(Math.floor((diff % minuteMs) / 1000));
    }

    tick();
    setInterval(tick, 1000);
  }

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function setOpeningLoaderProgress(value) {
    openingLoaderProgress = Math.max(0, Math.min(100, value));
    if (openingLoaderFill) {
      openingLoaderFill.style.width = openingLoaderProgress.toFixed(0) + '%';
    }
  }

  function hideOpeningLoader() {
    if (!openingLoaderEnabled || openingLoaderDone) return;
    openingLoaderDone = true;

    if (openingLoaderTimer) {
      clearInterval(openingLoaderTimer);
      openingLoaderTimer = null;
    }

    setOpeningLoaderProgress(100);
    window.setTimeout(function () {
      openingLoader.classList.add('is-hidden');
      openingLoader.setAttribute('aria-busy', 'false');
    }, 220);
  }

  function areCriticalAssetsReady() {
    var eagerImgs = document.querySelectorAll(
      '.wed2-hero img[loading="eager"], .wed2-hero img:not([loading="lazy"])'
    );
    var pending = 0;
    for (var i = 0; i < eagerImgs.length; i++) {
      var img = eagerImgs[i];
      if (img.getAttribute('src') && !img.complete) pending += 1;
    }
    return pending === 0;
  }

  function initOpeningLoader() {
    if (!openingLoaderEnabled) return;

    setOpeningLoaderProgress(8);
    openingLoader.classList.remove('is-hidden');
    openingLoader.setAttribute('aria-busy', 'true');

    var startedAt = Date.now();
    var minVisibleMs = 900;
    var maxWaitMs = 10000;
    var windowLoaded = document.readyState === 'complete';

    function tryFinish() {
      if (openingLoaderDone) return;
      var waited = Date.now() - startedAt;
      var assetsReady = areCriticalAssetsReady();
      var timedOut = waited >= maxWaitMs;
      if ((windowLoaded && assetsReady && waited >= minVisibleMs) || timedOut) {
        hideOpeningLoader();
      }
    }

    openingLoaderTimer = setInterval(function () {
      if (openingLoaderDone) {
        clearInterval(openingLoaderTimer);
        openingLoaderTimer = null;
        return;
      }
      if (openingLoaderProgress < 88) {
        setOpeningLoaderProgress(openingLoaderProgress + randomInRange(3, 9));
      }
      tryFinish();
    }, 260);

    if (!windowLoaded) {
      window.addEventListener('load', function () {
        windowLoaded = true;
        tryFinish();
      });
    }

    // Recheck as images finish decoding after first paint.
    var assetPoll = setInterval(function () {
      if (openingLoaderDone) {
        clearInterval(assetPoll);
        return;
      }
      tryFinish();
    }, 200);
    setTimeout(function () {
      clearInterval(assetPoll);
      hideOpeningLoader();
    }, maxWaitMs + 50);
  }

  // --- Evoke editor live-preview bridge ------------------------------------
  // The editor embeds this template in an iframe and streams the user's form
  // data in via postMessage (the shared `evoke:preview-*` protocol). We map the
  // section-keyed data onto the body's `data-*` attributes the template already
  // reads, then re-run hydrate() so edits reflect live.
  function initEvokeBridge() {
    // Flat data-path -> body attribute. Keys match schema.json.
    var ATTR_MAP = {
      'couple.groomName': 'data-groom-name',
      'couple.brideName': 'data-bride-name',
      'couple.groomParentPrefix': 'data-groom-parent-prefix',
      'couple.groomParentsName': 'data-groom-parents-name',
      'couple.brideParentPrefix': 'data-bride-parent-prefix',
      'couple.brideParentsName': 'data-bride-parents-name',
      'ceremony.date': 'data-event-date',
      'ceremony.time': 'data-event-time',
      'ceremony.quote': 'data-quote',
      'ceremony.invitationMessage': 'data-invitation-message',
      'venue.address': 'data-event-address',
      'venue.mapLink': 'data-map-link',
      'venue.mapEmbed': 'data-map-embed'
    };

    function esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Rebuild the whole timeline from the items array so any number of events
    // renders (the static markup only ships 4 slots and hydrateTimeline() caps
    // at 4). This is authoritative: the preview always mirrors the editor's
    // list, replacing the template's static default events, so adding an event
    // appends to what's shown rather than colliding with stale markup.
    function rebuildTimeline(items) {
      var list = document.getElementById('wed2-timeline-list');
      if (!list || !Array.isArray(items)) return;
      var visible = items.filter(function (it) {
        return it && (it.title || it.time);
      });
      list.innerHTML = visible
        .map(function (it, idx) {
          var slot = idx + 1;
          return (
            '<li class="wed2-timeline-item" data-slot="' + slot + '">' +
            '<span class="wed2-timeline-dot" aria-hidden="true"></span>' +
            '<div class="wed2-timeline-card">' +
            '<h3 class="wed2-timeline-title" id="wed2-event-' + slot + '-title">' + esc(it.title) + '</h3>' +
            '<p class="wed2-timeline-time" id="wed2-event-' + slot + '-time">' + esc(it.time) + '</p>' +
            '</div></li>'
          );
        })
        .join('');
    }

    function applyEditorData(data) {
      if (!data || typeof data !== 'object') return;

      Object.keys(ATTR_MAP).forEach(function (path) {
        var parts = path.split('.');
        var section = data[parts[0]];
        if (!section || typeof section !== 'object') return;
        var value = section[parts[1]];
        if (value === undefined) return;
        body.setAttribute(ATTR_MAP[path], value == null ? '' : String(value));
      });

      // Mirror the first 4 events onto data-event-N-* attributes so the parts
      // that read them (countdown, scratch/details date & time) stay in sync.
      var timeline = (data.timeline && data.timeline.items) || null;
      if (Array.isArray(timeline)) {
        for (var i = 0; i < 4; i++) {
          var item = timeline[i] || {};
          body.setAttribute('data-event-' + (i + 1) + '-title', item.title ? String(item.title) : '');
          body.setAttribute('data-event-' + (i + 1) + '-time', item.time ? String(item.time) : '');
        }
      }

      // Gallery captions -> polaroid slots (max 4).
      var gallery = (data.gallery && data.gallery.items) || null;
      if (Array.isArray(gallery)) {
        body.setAttribute('data-polaroid-count', String(Math.min(4, gallery.length)));
        for (var j = 0; j < 4; j++) {
          var g = gallery[j] || {};
          body.setAttribute('data-polaroid-' + (j + 1) + '-caption', g.caption ? String(g.caption) : '');
        }
      }

      hydrate();

      // Render every event (not just the 4 static slots) after hydrate() so this
      // wins over hydrateTimeline()'s fixed-slot output.
      if (Array.isArray(timeline)) {
        rebuildTimeline(timeline);
      }

      // Reflect a changed map embed immediately (loadMapIframe caches otherwise).
      if (mapIframe) {
        var embed = getAttr('data-map-embed', '');
        if (embed && mapIframe.getAttribute('src') !== embed) {
          mapIframe.src = embed;
          mapLoaded = true;
        }
      }
    }

    var parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
    window.addEventListener('message', function (e) {
      if (!e || e.source !== window.parent || e.origin !== parentOrigin) return;
      if (e && e.data && e.data.channel === 'evoke:preview-update' && e.data.version === 1) {
        applyEditorData(e.data.data);
      }
    });

    // Announce readiness so the editor pushes the current data immediately.
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ channel: 'evoke:preview-ready', version: 1 }, parentOrigin);
      }
    } catch (_) {}
  }

  hydrate();
  initializeAudio();
  initPolaroidThreads();
  initCoverOpener();
  initMute();
  startCountdown();
  showMuteButton(false);
  initOpeningLoader();
  applyStyleChoice('general');
  showSession(sessionCover);
  initEvokeBridge();
})();
