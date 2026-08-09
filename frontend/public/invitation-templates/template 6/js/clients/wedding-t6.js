/**
 * Wedding T6: door video opening → looping intro + scroll invitation.
 */
(function () {
  'use strict';

  var body = document.body;
  if (!body) return;

  var sessionOpening = document.getElementById('wed6-session-opening');
  var sessionInvite = document.getElementById('wed6-session-invite');
  var doorVideo = document.getElementById('wed6-door-video');
  var introVideo = document.getElementById('wed6-intro-video');
  var doorTap = document.getElementById('wed6-door-tap');
  var doorTapLabel = document.getElementById('wed6-door-tap-label');
  var doorTapRing = doorTap ? doorTap.querySelector('.wed6-door-tap-ring') : null;
  var openingStage = document.getElementById('wed6-opening-stage');
  var openingLoader = document.getElementById('wed6-opening-loader');
  var openingLoaderFill = document.getElementById('wed6-opening-loader-fill');
  var heroInvite = document.getElementById('wed6-hero-invite');
  var heroAmp = document.getElementById('wed6-hero-amp');
  var heroDateBlock = document.getElementById('wed6-hero-date-block');
  var heroVeil = document.querySelector('.wed6-hero-veil');
  var scrollHint = document.getElementById('wed6-scroll-hint');
  var scrollPage = document.getElementById('wed6-scroll-page');
  var audio = document.getElementById('wed6-music');
  var knockSfx = document.getElementById('wed6-knock-sfx');
  var doorOpenSfx = document.getElementById('wed6-door-open-sfx');
  var muteBtn = document.getElementById('wed6-mute-btn');

  var countdownEls = {
    days: document.getElementById('wed6-countdown-days'),
    hours: document.getElementById('wed6-countdown-hours'),
    minutes: document.getElementById('wed6-countdown-minutes'),
    seconds: document.getElementById('wed6-countdown-seconds')
  };

  var openingStarted = false;
  var openingTransitioned = false;
  var doorVideoReady = false;
  var openingLoaderTimer = null;
  var openingLoaderProgress = 0;
  var namesShown = false;
  var scrollHintDismissed = false;
  var scrollUnlockGraceUntil = 0;
  var inviteScrollLocked = false;
  var mapLoaded = {};
  var knockCount = 0;
  var knockBusy = false;
  var knocksRequiredRaw = parseInt(getAttr('data-knocks-required', ''), 10);
  var KNOCKS_REQUIRED = !isNaN(knocksRequiredRaw) && knocksRequiredRaw > 0 ? knocksRequiredRaw : 3;
  var KNOCK_ANIM_MS = 320;
  var INVITE_FADE_MS = 1100;
  var LETTER_STAGGER_MS = 100;
  var LETTER_ANIM_MS = 1100;
  var NAME_GAP_MS = 300;
  /* Dev: skip door knocks and land on intro video. Set false before shipping. */
  var DEV_SKIP_DOOR = false;

  function getAttr(name, fallback) {
    var val = body.getAttribute(name);
    if (val === null || val === '') return fallback == null ? '' : fallback;
    return val;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : value;
  }

  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value == null ? '' : value;
  }

  function formatParentsName(value) {
    if (!value) return '';
    if (value.indexOf('|') === -1) return value;
    return value.split('|').map(function (line) {
      return line.trim();
    }).join('<br>');
  }

  function buildBlessingsNames(raw) {
    var container = document.getElementById('wed6-blessings-names');
    if (!container) return;

    container.innerHTML = '';
    if (!raw) return;

    var lines = raw.indexOf('|') !== -1 ? raw.split('|') : [raw];
    var index = 0;

    lines.forEach(function (line) {
      var trimmedLine = line.trim();
      if (!trimmedLine) return;

      if (trimmedLine === '&') {
        var ampEl = document.createElement('span');
        ampEl.className = 'wed6-blessings-amp';
        ampEl.setAttribute('aria-hidden', 'true');
        ampEl.textContent = '&';
        container.appendChild(ampEl);
        return;
      }

      var lineEl = document.createElement('span');
      lineEl.className = 'wed6-blessings-line';

      var namesRaw = trimmedLine;
      var labelMatch = trimmedLine.match(/^([^:,]+):\s*(.+)$/);
      if (labelMatch) {
        lineEl.classList.add('is-grouped');
        var groupLabel = document.createElement('span');
        groupLabel.className = 'wed6-blessings-group-label';
        groupLabel.textContent = labelMatch[1].trim();
        lineEl.appendChild(groupLabel);
        namesRaw = labelMatch[2].trim();
      }

      var parts = namesRaw.split(',').map(function (part) {
        return part.trim();
      }).filter(Boolean);

      var namesParent = lineEl;
      if (labelMatch) {
        namesParent = document.createElement('span');
        namesParent.className = 'wed6-blessings-line-names';
        lineEl.appendChild(namesParent);
      }

      parts.forEach(function (part, partIdx) {
        var nameEl = document.createElement('span');
        nameEl.className = 'wed6-blessings-name';
        nameEl.style.setProperty('--wed6-bless-i', String(index));
        nameEl.textContent = part;
        namesParent.appendChild(nameEl);

        if (partIdx < parts.length - 1) {
          var sep = document.createElement('span');
          sep.className = 'wed6-blessings-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.style.setProperty('--wed6-bless-i', String(index));
          sep.textContent = ', ';
          namesParent.appendChild(sep);
        }

        index += 1;
      });

      container.appendChild(lineEl);
    });
  }

  function formatLongDate(dateRaw) {
    if (!dateRaw) return '';
    var d = new Date(dateRaw + 'T00:00:00');
    if (isNaN(d.getTime())) return dateRaw;
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatTimelineDate(dateRaw) {
    if (!dateRaw) return '';
    var d = new Date(dateRaw + 'T00:00:00');
    if (isNaN(d.getTime())) return dateRaw;
    var day = d.getDate();
    var month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    return day + ' ' + month;
  }

  function getTimeDisplayLabel(rawTime) {
    var parsed = (rawTime || '').split('-')[0].trim();
    if (!parsed) return '';
    return 'AT ' + parsed.toUpperCase();
  }

  function formatHeroDate(dateRaw) {
    if (!dateRaw) return '';
    var d = new Date(dateRaw + 'T00:00:00');
    if (isNaN(d.getTime())) return dateRaw;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatTelHref(phone) {
    return 'tel:' + String(phone || '').replace(/\s/g, '');
  }

  function encodedStoragePath(attr) {
    return attr ? attr.replace(/^\//, '') : '';
  }

  function decodedStoragePath(attr) {
    if (!attr) return '';
    var raw = attr.replace(/^\//, '');
    try {
      return decodeURIComponent(raw);
    } catch (err) {
      return raw.replace(/%2F/g, '/');
    }
  }

  function resolvePathOnlyImageUrl(storagePath, baseUrl, cb) {
    var path = decodedStoragePath(storagePath);
    var encoded = encodedStoragePath(storagePath);
    var bucket = 'my-bel0ved.firebasestorage.app';

    function setUrl(url) {
      if (url && typeof cb === 'function') cb(url);
    }

    function trySdk() {
      try {
        if (window.firebase && firebase.storage) {
          firebase.storage().ref(path).getDownloadURL().then(setUrl).catch(tryRest);
          return;
        }
      } catch (e) { /* fall through */ }
      tryRest();
    }

    function tryRest() {
      var metaUrl = 'https://firebasestorage.googleapis.com/v0/b/' + bucket + '/o/' + encoded;
      fetch(metaUrl)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (meta) {
          if (meta && meta.downloadTokens) {
            setUrl(baseUrl + encoded + '?alt=media&token=' + meta.downloadTokens.split(',')[0]);
          } else if (baseUrl) {
            setUrl(baseUrl + encoded + '?alt=media');
          }
        })
        .catch(function () {
          if (baseUrl) setUrl(baseUrl + encoded + '?alt=media');
        });
    }

    trySdk();
  }

  function applyFirebaseAsset(el) {
    var baseUrl = window.FirebaseConfig && window.FirebaseConfig.storageBaseUrl;
    if (!el) return;

    var storagePath = el.getAttribute('data-storage-path');
    if (!storagePath) return;

    var existingSrc = el.getAttribute('src');
    var token = el.getAttribute('data-token');
    var encoded = encodedStoragePath(storagePath);

    function setSrc(url) {
      if (!url) {
        if (existingSrc && !el.getAttribute('src')) el.setAttribute('src', existingSrc);
        return;
      }
      var current = el.currentSrc || el.getAttribute('src') || el.src || '';
      /* Intro already has an inline Firebase src — don't restart buffering. */
      if (el.id === 'wed6-intro-video' && current.indexOf(encoded) !== -1) {
        return;
      }
      if (current === url || (el.tagName === 'VIDEO' && current.indexOf(encoded) !== -1)) {
        return;
      }
      if (el.tagName === 'SOURCE') {
        el.src = url;
        var audioEl = el.closest('audio');
        if (audioEl) audioEl.load();
      } else {
        el.src = url;
        if (el.tagName === 'VIDEO') el.load();
      }
    }

    if (baseUrl && token) {
      setSrc(baseUrl + encoded + '?alt=media&token=' + token);
      return;
    }

    if (baseUrl) {
      resolvePathOnlyImageUrl(storagePath, baseUrl, setSrc);
    } else if (existingSrc) {
      el.setAttribute('src', existingSrc);
    }
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

  function initializeFirebaseAudio() {
    if (!audio) return;
    applyMusicVolume();
    var source = audio.querySelector('source[data-storage-path]');
    if (source) applyFirebaseAsset(source);
  }

  function playSfx(el) {
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch (e) { /* ignore */ }
    el.play().catch(function () { /* gesture may be required */ });
  }

  function startMusic() {
    if (!audio) return;
    audio.play().catch(function () { /* gesture may be required */ });
    showMuteButton(true);
  }

  function startMusicAfterDoorOpenSound() {
    if (!doorOpenSfx) {
      startMusic();
      return;
    }

    var started = false;
    function beginSong() {
      if (started) return;
      started = true;
      doorOpenSfx.removeEventListener('ended', beginSong);
      startMusic();
    }

    doorOpenSfx.addEventListener('ended', beginSong);
    playSfx(doorOpenSfx);

    // Fallback if ended never fires
    window.setTimeout(beginSong, 8000);
  }

  function showMuteButton(show) {
    if (!muteBtn) return;
    if (show) muteBtn.removeAttribute('aria-hidden');
    else muteBtn.setAttribute('aria-hidden', 'true');
  }

  function initMute() {
    if (!muteBtn || !audio) return;
    muteBtn.addEventListener('click', function () {
      audio.muted = !audio.muted;
      muteBtn.classList.toggle('is-muted', audio.muted);
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute music' : 'Mute music');
    });
  }

  /**
   * Instagram (and some WebViews) leave a paused <video> black until play().
   * Nudge a muted play, then freeze near the first frame so the door screen
   * shows the closed door before the user knocks.
   */
  function paintDoorFirstFrame() {
    if (!doorVideo || openingStarted) return;

    doorVideo.muted = true;
    doorVideo.setAttribute('playsinline', '');
    doorVideo.setAttribute('webkit-playsinline', 'true');

    function freezeNearStart() {
      if (!doorVideo || openingStarted) return;
      try {
        doorVideo.pause();
        if (doorVideo.currentTime > 0.15) {
          doorVideo.currentTime = 0.05;
        }
      } catch (e) { /* ignore seek errors */ }
    }

    var playPromise = doorVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(function () {
          requestAnimationFrame(function () {
            requestAnimationFrame(freezeNearStart);
          });
        })
        .catch(function () {
          try {
            doorVideo.currentTime = 0.05;
          } catch (e) { /* ignore */ }
        });
      return;
    }

    freezeNearStart();
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

  function startOpeningLoader() {
    if (!openingLoader || doorVideoReady) return;
    if (openingLoaderTimer) clearInterval(openingLoaderTimer);
    setOpeningLoaderProgress(8);
    openingLoader.classList.remove('is-hidden');
    openingLoader.setAttribute('aria-busy', 'true');
    openingLoaderTimer = setInterval(function () {
      if (doorVideoReady) {
        clearInterval(openingLoaderTimer);
        openingLoaderTimer = null;
        return;
      }
      if (openingLoaderProgress < 88) {
        setOpeningLoaderProgress(openingLoaderProgress + randomInRange(3, 9));
      }
    }, 260);
  }

  function markDoorVideoReady() {
    if (doorVideoReady) return;
    doorVideoReady = true;

    if (openingLoaderTimer) {
      clearInterval(openingLoaderTimer);
      openingLoaderTimer = null;
    }

    setOpeningLoaderProgress(100);
    if (openingStage) openingStage.classList.add('is-video-ready');
    if (doorTap) {
      doorTap.hidden = false;
      doorTap.removeAttribute('hidden');
    }

    if (openingLoader) {
      window.setTimeout(function () {
        openingLoader.classList.add('is-hidden');
        openingLoader.setAttribute('aria-busy', 'false');
      }, 220);
    }

    // Do not pause+seek(0) here: Instagram WebViews often paint paused videos black.
    paintDoorFirstFrame();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function fillZoomLetters(el, text) {
    if (!el) return [];
    el.textContent = '';
    var letters = [];
    String(text || '').split('').forEach(function (ch) {
      var span = document.createElement('span');
      span.className = 'wed6-zoom-letter';
      if (ch === ' ') {
        span.className += ' is-space';
        span.innerHTML = '&nbsp;';
      } else {
        span.textContent = ch;
      }
      el.appendChild(span);
      letters.push(span);
    });
    return letters;
  }

  function animateZoomLetters(letters, startDelay) {
    var delay = startDelay || 0;
    letters.forEach(function (letter, index) {
      window.setTimeout(function () {
        letter.classList.add('is-in');
      }, delay + index * LETTER_STAGGER_MS);
    });
    if (!letters.length) return delay;
    return delay + (letters.length - 1) * LETTER_STAGGER_MS + LETTER_ANIM_MS;
  }

  function showScrollHint() {
    if (!scrollHint) return;
    scrollHint.classList.add('is-visible');
    scrollHint.removeAttribute('aria-hidden');
  }

  function forceScrollTop(top) {
    if (!scrollPage) return;
    /* Instant jump — smooth scroll-behavior fights lock resets and stutters. */
    var prev = scrollPage.style.scrollBehavior;
    scrollPage.style.scrollBehavior = 'auto';
    scrollPage.scrollTop = top == null ? 0 : top;
    window.requestAnimationFrame(function () {
      if (!scrollPage) return;
      scrollPage.style.scrollBehavior = prev;
    });
  }

  function lockInviteScroll() {
    if (!scrollPage || inviteScrollLocked) return;
    inviteScrollLocked = true;
    scrollPage.classList.add('is-scroll-locked');
    forceScrollTop(0);
  }

  function unlockInviteScroll() {
    if (!scrollPage || !inviteScrollLocked) return;
    inviteScrollLocked = false;
    scrollPage.classList.remove('is-scroll-locked');
    /* Brief grace so iOS bounce cannot yank the hero mid-frame after unlock. */
    scrollUnlockGraceUntil = Date.now() + 280;
    forceScrollTop(0);
    window.requestAnimationFrame(function () {
      forceScrollTop(0);
    });
  }

  function preventLockedScroll(event) {
    if (!inviteScrollLocked && Date.now() >= scrollUnlockGraceUntil) return;
    event.preventDefault();
  }

  function revealHeroDate() {
    if (heroDateBlock) heroDateBlock.classList.add('is-visible');
    /* Keep scroll locked until the date fade/slide finishes (~0.9s). */
    var dateRevealMs = prefersReducedMotion() ? 0 : 950;
    window.setTimeout(function () {
      showScrollHint();
      unlockInviteScroll();
    }, dateRevealMs);
  }

  function showNamesOverlay() {
    if (namesShown) return;
    namesShown = true;

    var groomEl = document.getElementById('wed6-hero-groom');
    var brideEl = document.getElementById('wed6-hero-bride');
    var groomName = getAttr('data-groom-display-name', '') || getAttr('data-groom-name', '');
    var brideName = getAttr('data-bride-display-name', '') || getAttr('data-bride-name', '');
    var groomLetters = fillZoomLetters(groomEl, groomName);
    var brideLetters = fillZoomLetters(brideEl, brideName);

    if (prefersReducedMotion()) {
      if (heroInvite) heroInvite.classList.add('is-visible');
      groomLetters.forEach(function (letter) { letter.classList.add('is-in'); });
      if (heroAmp) heroAmp.classList.add('is-in');
      brideLetters.forEach(function (letter) { letter.classList.add('is-in'); });
      revealHeroDate();
      return;
    }

    // 1) Invite line fades in
    if (heroInvite) {
      window.requestAnimationFrame(function () {
        heroInvite.classList.add('is-visible');
      });
    }

    // 2) Groom letters zoom out one by one
    var afterGroom = animateZoomLetters(groomLetters, INVITE_FADE_MS + 180);

    // 3) Ampersand, then bride letters
    window.setTimeout(function () {
      if (heroAmp) heroAmp.classList.add('is-in');
    }, afterGroom + 80);

    var afterBride = animateZoomLetters(brideLetters, afterGroom + NAME_GAP_MS + 220);

    // 4) Date at the bottom once names settle
    window.setTimeout(revealHeroDate, afterBride + 200);
  }

  function transitionToInvite() {
    if (openingTransitioned) return;
    openingTransitioned = true;

    if (sessionOpening) sessionOpening.classList.remove('is-active');
    if (sessionInvite) {
      sessionInvite.classList.add('is-active');
      sessionInvite.setAttribute('aria-hidden', 'false');
    }
    showMuteButton(true);
    lockInviteScroll();

    ensureIntroPlaying();

    // Fade veil in after a frame so the transition runs from opacity 0
    if (heroVeil) {
      heroVeil.classList.remove('is-active');
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          heroVeil.classList.add('is-active');
        });
      });
    }

    // Start copy animation as soon as the intro video session begins
    showNamesOverlay();
  }

  function ensureIntroPlaying() {
    if (!introVideo) return;
    introVideo.muted = true;
    introVideo.loop = true;
    introVideo.setAttribute('playsinline', '');
    introVideo.setAttribute('webkit-playsinline', '');

    function attemptPlay() {
      var playPromise = introVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () { /* autoplay policies */ });
      }
    }

    attemptPlay();

    if (introVideo.readyState < 2) {
      ['loadeddata', 'canplay', 'canplaythrough'].forEach(function (eventName) {
        introVideo.addEventListener(eventName, attemptPlay, { once: true });
      });
    }
  }

  /**
   * Eager clients (body.wed6-intro-eager): play briefly under the door at
   * near-zero opacity so the decoder buffers, then pause. When the door
   * finishes, ensureIntroPlaying() resumes from that frame and loops.
   * Other clients: soft-prime then pause immediately.
   */
  function warmIntroVideoBuffer() {
    if (!introVideo) return;
    if (!(introVideo.currentSrc || introVideo.getAttribute('src'))) return;

    var eager = body.classList.contains('wed6-intro-eager');
    introVideo.muted = true;
    introVideo.loop = !!eager;
    introVideo.setAttribute('playsinline', '');
    introVideo.setAttribute('webkit-playsinline', '');

    if (!eager) {
      try { introVideo.load(); } catch (e) { /* ignore */ }
    }

    function pauseUnderDoor() {
      if (openingTransitioned) return;
      try { introVideo.pause(); } catch (e) { /* ignore */ }
    }

    function scheduleEagerPause() {
      /* Play a short stretch so frames decode, then freeze under the door. */
      var paused = false;
      function pauseOnce() {
        if (paused || openingTransitioned) return;
        paused = true;
        pauseUnderDoor();
      }

      window.setTimeout(pauseOnce, 450);

      introVideo.addEventListener('timeupdate', function onTick() {
        if (introVideo.currentTime >= 0.2) {
          introVideo.removeEventListener('timeupdate', onTick);
          pauseOnce();
        }
      });
    }

    var priming = introVideo.play();
    if (priming && typeof priming.then === 'function') {
      priming
        .then(function () {
          if (openingTransitioned) return;
          if (eager) scheduleEagerPause();
          else pauseUnderDoor();
        })
        .catch(function () {
          /* Autoplay blocked — still try to load enough data for later play. */
          if (!eager) return;
          ['loadeddata', 'canplay'].forEach(function (eventName) {
            introVideo.addEventListener(eventName, function () {
              if (openingTransitioned) return;
              introVideo.play().then(scheduleEagerPause).catch(function () { /* ignore */ });
            }, { once: true });
          });
        });
    } else if (eager) {
      scheduleEagerPause();
    } else {
      pauseUnderDoor();
    }
  }

  function onDoorEnded() {
    transitionToInvite();
  }

  function updateKnockLabel() {
    if (!doorTapLabel) return;
    if (knockCount <= 0) {
      doorTapLabel.textContent = 'Knock on the door';
    } else if (knockCount < KNOCKS_REQUIRED - 1) {
      doorTapLabel.textContent = 'Knock again';
    } else if (knockCount < KNOCKS_REQUIRED) {
      doorTapLabel.textContent = KNOCKS_REQUIRED <= 2 ? 'Knock again' : 'One more knock';
    }
  }

  function playKnockFeedback() {
    playSfx(knockSfx);

    if (doorVideo) {
      doorVideo.classList.remove('is-knocking');
      void doorVideo.offsetWidth;
      doorVideo.classList.add('is-knocking');
    }
    if (doorTapRing) {
      doorTapRing.classList.remove('is-knock-flash');
      void doorTapRing.offsetWidth;
      doorTapRing.classList.add('is-knock-flash');
    }

    window.setTimeout(function () {
      if (doorVideo) doorVideo.classList.remove('is-knocking');
      if (doorTapRing) doorTapRing.classList.remove('is-knock-flash');
      knockBusy = false;
    }, KNOCK_ANIM_MS);
  }

  function handleDoorKnock() {
    if (openingStarted || knockBusy) return;

    knockCount += 1;
    updateKnockLabel();

    if (knockCount < KNOCKS_REQUIRED) {
      knockBusy = true;
      playKnockFeedback();
      return;
    }

    startOpening();
  }

  function startOpening() {
    if (openingStarted) return;
    openingStarted = true;
    knockBusy = false;

    if (doorTap) doorTap.classList.add('is-hidden');
    if (doorVideo) doorVideo.classList.remove('is-knocking');

    // Door open SFX first; wedding song starts when that sound ends
    startMusicAfterDoorOpenSound();

    if (!doorVideo) {
      transitionToInvite();
      return;
    }

    doorVideo.muted = false;
    var playPromise = doorVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(function () {
        doorVideo.muted = true;
        doorVideo.play().catch(function () {
          transitionToInvite();
        });
      });
    }
  }

  function initOpening() {
    if (DEV_SKIP_DOOR) {
      openingStarted = true;
      markDoorVideoReady();
      transitionToInvite();
      startMusic();
      return;
    }

    updateKnockLabel();

    if (doorVideo) {
      doorVideo.addEventListener('ended', onDoorEnded);
      ['loadeddata', 'canplay', 'canplaythrough'].forEach(function (eventName) {
        doorVideo.addEventListener(eventName, markDoorVideoReady, { once: true });
      });

      if (doorVideo.readyState >= 2 && doorVideo.currentSrc) {
        markDoorVideoReady();
      } else {
        startOpeningLoader();
        /* Fallback if Firebase/video stalls. */
        window.setTimeout(function () {
          if (!doorVideoReady) markDoorVideoReady();
        }, 16000);
      }
    } else {
      markDoorVideoReady();
    }

    if (doorTap) {
      doorTap.addEventListener('click', function (e) {
        e.preventDefault();
        handleDoorKnock();
      });
    }

    if (doorVideo) {
      doorVideo.addEventListener('click', function () {
        if (!openingStarted) handleDoorKnock();
      });
    }
  }

  function dismissScrollHint() {
    if (!scrollHint || scrollHintDismissed) return;
    scrollHintDismissed = true;
    scrollHint.classList.remove('is-visible');
    scrollHint.classList.add('is-hidden');
  }

  function initScrollHint() {
    if (!scrollPage) return;
    scrollPage.addEventListener('wheel', preventLockedScroll, { passive: false });
    scrollPage.addEventListener('touchmove', preventLockedScroll, { passive: false });
    scrollPage.addEventListener('scroll', function () {
      if (inviteScrollLocked || Date.now() < scrollUnlockGraceUntil) {
        forceScrollTop(0);
        return;
      }
      if (scrollPage.scrollTop > 24) dismissScrollHint();
    }, { passive: true });
  }

  function getCalendarDateRaw() {
    return (
      getAttr('data-primary-date', '') ||
      getAttr('data-event-1-date', '') ||
      getAttr('data-event-date', '')
    );
  }

  function hydrateSaveTheDate() {
    var dateEl = document.getElementById('wed6-std-date');
    var monthEl = document.getElementById('wed6-std-month');
    var yearEl = document.getElementById('wed6-std-year');
    var dayEl = document.getElementById('wed6-std-day');
    if (!dateEl) return;

    var dateRaw = getCalendarDateRaw();
    var eventDate = new Date(dateRaw + 'T00:00:00');
    if (isNaN(eventDate.getTime())) {
      dateEl.textContent = '';
      if (monthEl) monthEl.textContent = '';
      if (yearEl) yearEl.textContent = '';
      if (dayEl) dayEl.textContent = '';
      return;
    }

    dateEl.textContent = String(eventDate.getDate());
    if (monthEl) {
      monthEl.textContent = eventDate.toLocaleDateString('en-GB', { month: 'long' });
    }
    if (yearEl) yearEl.textContent = String(eventDate.getFullYear());
    if (dayEl) {
      dayEl.textContent = eventDate.toLocaleDateString('en-GB', { weekday: 'long' });
    }
  }

  function getCountdownTarget() {
    var dateRaw =
      getAttr('data-primary-date', '') ||
      getAttr('data-event-1-date', '') ||
      getAttr('data-event-date', '');
    var eventTimeRaw =
      getAttr('data-countdown-time', '') ||
      getAttr('data-event-1-time', '') ||
      getAttr('data-event-time', '11:00 AM');
    var timeStart = eventTimeRaw.split('-')[0].trim();
    var dateTime = new Date(dateRaw + ' ' + timeStart);
    if (isNaN(dateTime.getTime())) dateTime = new Date(dateRaw + 'T11:00:00');
    return { dateRaw: dateRaw, dateTime: dateTime };
  }

  function hydrateCountdown() {
    var target = getCountdownTarget();
    var eventTimeRaw =
      getAttr('data-countdown-time', '') ||
      getAttr('data-event-1-time', '') ||
      getAttr('data-event-time', '');
    var timeStart = eventTimeRaw.split('-')[0].trim();
    var label = formatLongDate(target.dateRaw);
    if (label && timeStart) label += ' at ' + timeStart;
    setText('wed6-countdown-date', label);
  }

  function startCountdown() {
    if (!countdownEls.days) return;
    var dateTime = getCountdownTarget().dateTime;
    if (isNaN(dateTime.getTime())) return;

    function tick() {
      var diff = dateTime.getTime() - Date.now();
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

  function getVenueCount() {
    var count = parseInt(getAttr('data-venue-count', '1'), 10);
    if (isNaN(count) || count < 1) count = 1;
    if (count > 4) count = 4;
    return count;
  }

  function loadVenueMap(index) {
    if (mapLoaded[index]) return;
    var iframe = document.getElementById('wed6-map-iframe-' + index);
    if (!iframe) return;
    var embedUrl = getAttr('data-venue-' + index + '-map-embed', getAttr('data-map-embed', ''));
    if (!embedUrl) return;
    iframe.src = embedUrl;
    mapLoaded[index] = true;
  }

  function buildVenues() {
    var carousel = document.getElementById('wed6-venues-carousel');
    var trackEl = document.getElementById('wed6-venues-track');
    var dotsEl = document.getElementById('wed6-venue-dots');
    var prevBtn = document.getElementById('wed6-venue-prev');
    var nextBtn = document.getElementById('wed6-venue-next');
    var section = document.getElementById('wed6-venues');
    if (!carousel || !trackEl) return;

    var count = getVenueCount();
    trackEl.innerHTML = '';
    if (dotsEl) dotsEl.innerHTML = '';

    if (count < 1) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;

    var activeIndex = 1;
    var hasMultiple = count > 1;
    carousel.classList.toggle('is-single', !hasMultiple);

    for (var i = 1; i <= count; i++) {
      var label = getAttr('data-venue-' + i + '-label', 'Venue ' + i);
      var address = getAttr('data-venue-' + i + '-address', getAttr('data-event-address', ''));
      var mapLink = getAttr('data-venue-' + i + '-map-link', getAttr('data-map-link', '#'));
      var directionsLink = getAttr('data-venue-' + i + '-directions-link', '');
      if (!directionsLink) {
        if (address) {
          directionsLink =
            'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
        } else if (mapLink && mapLink.indexOf('/maps/dir/') !== -1) {
          directionsLink = mapLink;
        } else {
          directionsLink = mapLink || '#';
        }
      }

      var slide = document.createElement('article');
      slide.className = 'wed6-venue-slide' + (i === 1 ? ' is-active' : '');
      slide.setAttribute('data-venue-index', String(i));
      slide.setAttribute('aria-hidden', i === 1 ? 'false' : 'true');
      /* Escape & in href — raw & in innerHTML breaks query strings like ?api=1&destination= */
      var directionsHref = String(directionsLink).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      slide.innerHTML =
        '<div class="wed6-venue-body">' +
          '<p class="wed6-venue-label">' + label + '</p>' +
          '<div class="wed6-map-frame">' +
            '<iframe class="wed6-map-iframe" id="wed6-map-iframe-' + i + '" title="' + label + ' map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>' +
          '</div>' +
          '<p class="wed6-venue-address">' + address + '</p>' +
          '<a class="wed6-btn-map" href="' + directionsHref + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="wed6-btn-map-pin" aria-hidden="true"></span>' +
            '<span>Get directions</span>' +
          '</a>' +
        '</div>';
      trackEl.appendChild(slide);

      if (dotsEl && hasMultiple) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'wed6-venue-dot' + (i === 1 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Show venue ' + i);
        dot.setAttribute('data-venue-index', String(i));
        dotsEl.appendChild(dot);
      }
    }

    function showVenue(index, enterFrom) {
      var from = activeIndex;
      if (index < 1) index = count;
      if (index > count) index = 1;

      if (!enterFrom && index !== from) {
        if (from === count && index === 1) enterFrom = 'right';
        else if (from === 1 && index === count) enterFrom = 'left';
        else enterFrom = index > from ? 'right' : 'left';
      }

      activeIndex = index;

      trackEl.querySelectorAll('.wed6-venue-slide').forEach(function (slide) {
        var slideIndex = parseInt(slide.getAttribute('data-venue-index'), 10);
        var active = slideIndex === activeIndex;
        slide.classList.remove('is-active', 'is-enter-from-left', 'is-enter-from-right');
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) {
          if (enterFrom === 'left') slide.classList.add('is-enter-from-left');
          else if (enterFrom === 'right') slide.classList.add('is-enter-from-right');
          // Force reflow so animation restarts when switching quickly
          void slide.offsetWidth;
          slide.classList.add('is-active');
        }
      });

      if (dotsEl) {
        dotsEl.querySelectorAll('.wed6-venue-dot').forEach(function (dot) {
          var dotIndex = parseInt(dot.getAttribute('data-venue-index'), 10);
          dot.classList.toggle('is-active', dotIndex === activeIndex);
        });
      }

      loadVenueMap(activeIndex);
    }

    if (prevBtn) {
      prevBtn.hidden = !hasMultiple;
      prevBtn.onclick = function () { showVenue(activeIndex - 1, 'left'); };
    }
    if (nextBtn) {
      nextBtn.hidden = !hasMultiple;
      nextBtn.onclick = function () { showVenue(activeIndex + 1, 'right'); };
    }

    if (dotsEl) {
      dotsEl.hidden = !hasMultiple;
      dotsEl.onclick = function (e) {
        var dot = e.target.closest('.wed6-venue-dot');
        if (!dot) return;
        var index = parseInt(dot.getAttribute('data-venue-index'), 10);
        if (!isNaN(index)) showVenue(index);
      };
    }

    if (hasMultiple) {
      var stageEl = carousel.querySelector('.wed6-venues-stage') || trackEl;
      var swipeStartX = null;
      var swipeStartY = null;
      var swipeThreshold = 46;

      function swipeIgnoreTarget(target) {
        return !!(target && target.closest && target.closest('a, button, iframe, .wed6-venue-nav'));
      }

      function onSwipeStart(x, y, target) {
        if (swipeIgnoreTarget(target)) {
          swipeStartX = null;
          swipeStartY = null;
          return;
        }
        swipeStartX = x;
        swipeStartY = y;
      }

      function onSwipeEnd(x, y) {
        if (swipeStartX == null) return;
        var dx = x - swipeStartX;
        var dy = y - swipeStartY;
        swipeStartX = null;
        swipeStartY = null;
        if (Math.abs(dx) < swipeThreshold || Math.abs(dx) < Math.abs(dy) * 1.1) return;
        if (dx < 0) showVenue(activeIndex + 1, 'right');
        else showVenue(activeIndex - 1, 'left');
      }

      stageEl.addEventListener('touchstart', function (e) {
        var t = e.changedTouches[0];
        onSwipeStart(t.clientX, t.clientY, e.target);
      }, { passive: true });

      stageEl.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        onSwipeEnd(t.clientX, t.clientY);
      }, { passive: true });

      stageEl.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        onSwipeStart(e.clientX, e.clientY, e.target);
      });

      stageEl.addEventListener('pointerup', function (e) {
        onSwipeEnd(e.clientX, e.clientY);
      });

      stageEl.addEventListener('pointercancel', function () {
        swipeStartX = null;
        swipeStartY = null;
      });
    }

    showVenue(1);
  }

  function buildTimeline() {
    var list = document.getElementById('wed6-timeline-list');
    if (!list) return;
    list.innerHTML = '';

    var eventIndex = 0;
    for (var i = 1; i <= 5; i++) {
      var title = getAttr('data-event-' + i + '-title', '');
      if (!title) continue;
      eventIndex += 1;
      var dateRaw = getAttr('data-event-' + i + '-date', '') || getAttr('data-event-date', '');
      var time = getAttr('data-event-' + i + '-time', '');
      var dateLabel = formatTimelineDate(dateRaw);
      var metaHtml = '';
      if (dateLabel) {
        metaHtml += '<span class="wed6-timeline-date">' + dateLabel + '</span>';
      }
      if (time) {
        metaHtml += '<span class="wed6-timeline-time">' + time + '</span>';
      }

      var side = eventIndex % 2 === 1 ? 'is-left' : 'is-right';
      var item = document.createElement('li');
      item.className = 'wed6-timeline-item ' + side;
      item.style.setProperty('--wed6-leaf-delay', (0.28 + (eventIndex - 1) * 0.38) + 's');
      item.innerHTML =
        '<div class="wed6-timeline-card">' +
          '<h3 class="wed6-timeline-title">' + title + '</h3>' +
          (metaHtml ? '<p class="wed6-timeline-meta">' + metaHtml + '</p>' : '') +
        '</div>' +
        '<span class="wed6-timeline-leaf" aria-hidden="true">' +
          '<span class="wed6-timeline-petiole"></span>' +
          '<span class="wed6-timeline-leaf-body">' +
            '<span class="wed6-timeline-leaf-blade"></span>' +
            '<span class="wed6-timeline-leaf-vein"></span>' +
          '</span>' +
        '</span>';
      list.appendChild(item);
    }

    var plant = document.getElementById('wed6-timeline-plant');
    if (plant) {
      plant.style.setProperty('--wed6-stem-duration', Math.max(1.7, 0.75 + eventIndex * 0.55) + 's');
    }
    prepareTimelineStem();

    if (!list.children.length) {
      var section = document.getElementById('wed6-timeline');
      if (section) section.hidden = true;
    }
  }

  function prepareTimelineStem() {
    var path = document.querySelector('#wed6-timeline .wed6-timeline-stem-path');
    if (!path || typeof path.getTotalLength !== 'function') return;
    var length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    path.setAttribute('data-stem-length', String(length));
  }

  function growTimelineStem() {
    var path = document.querySelector('#wed6-timeline .wed6-timeline-stem-path');
    if (!path) return;
    prepareTimelineStem();
    // Force layout so the transition starts from the dashed-hidden state
    void path.getBoundingClientRect();
    requestAnimationFrame(function () {
      path.style.strokeDashoffset = '0';
    });
    scheduleTimelineFallingLeaves();
  }

  function getTimelineAnimDurationMs() {
    var plant = document.getElementById('wed6-timeline-plant');
    var list = document.getElementById('wed6-timeline-list');
    var count = list ? list.children.length : 0;
    var stemSec = 1.9;

    if (plant) {
      var raw = window.getComputedStyle(plant).getPropertyValue('--wed6-stem-duration').trim();
      var parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) stemSec = parsed;
    }

    /* Cards/leaves finish around this; tip lands just after stem. */
    var lastLeafSec = count
      ? (0.28 + (count - 1) * 0.38 + 0.14 + 0.55)
      : 0;

    /* Start falling leaves as soon as the timeline feels complete. */
    return Math.round(Math.max(stemSec, lastLeafSec) * 1000 - 120);
  }

  function scheduleTimelineFallingLeaves() {
    var section = document.getElementById('wed6-timeline');
    var layer = document.getElementById('wed6-timeline-fall');
    if (!section || !layer || section.dataset.leavesPlayed === 'true') return;

    section.dataset.leavesPlayed = 'true';

    if (prefersReducedMotion()) return;

    window.setTimeout(function () {
      playTimelineFallingLeaves(layer);
    }, getTimelineAnimDurationMs());
  }

  function playTimelineFallingLeaves(layer) {
    if (!layer) return;
    layer.innerHTML = '';

    var colors = ['#9a6b48', '#b0765a', '#c19a6b', '#8a9a78', '#a07d5c', '#7d8f6a'];
    var count = 10;
    var maxDuration = 0;

    for (var i = 0; i < count; i++) {
      var leaf = document.createElement('span');
      leaf.className = 'wed6-timeline-fall-leaf';
      var size = (0.55 + Math.random() * 0.55).toFixed(2);
      var duration = (3.4 + Math.random() * 1.8);
      var delay = (Math.random() * 1.1);
      var drift = ((Math.random() - 0.5) * 120).toFixed(0);
      var spin = ((Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 220)).toFixed(0);
      var sway = ((Math.random() - 0.5) * 56).toFixed(0);

      leaf.style.left = (4 + Math.random() * 92).toFixed(1) + '%';
      leaf.style.width = size + 'rem';
      leaf.style.height = (size * 1.35).toFixed(2) + 'rem';
      leaf.style.background = colors[i % colors.length];
      leaf.style.animationDuration = duration.toFixed(2) + 's';
      leaf.style.animationDelay = delay.toFixed(2) + 's';
      leaf.style.setProperty('--wed6-fall-drift', drift + 'px');
      leaf.style.setProperty('--wed6-fall-spin', spin + 'deg');
      leaf.style.setProperty('--wed6-fall-sway', sway + 'px');
      layer.appendChild(leaf);

      maxDuration = Math.max(maxDuration, duration + delay);
    }

    window.setTimeout(function () {
      if (layer) layer.innerHTML = '';
    }, Math.round(maxDuration * 1000) + 400);
  }

  function hydrateContact() {
    var wrap = document.getElementById('wed6-contact-actions');
    if (!wrap) return;
    wrap.innerHTML = '';
    var phone1 = getAttr('data-contact-phone', '');
    var phone2 = getAttr('data-contact-phone-2', '');

    function addBtn(phone, label) {
      if (!phone) return;
      var a = document.createElement('a');
      a.className = 'wed6-btn wed6-btn-contact';
      a.href = formatTelHref(phone);
      a.textContent = label || phone;
      wrap.appendChild(a);
    }

    if (phone1 && phone2) {
      addBtn(phone1, 'Call ' + phone1);
      addBtn(phone2, 'Call ' + phone2);
    } else if (phone1) {
      addBtn(phone1, 'Contact Us');
    } else if (phone2) {
      addBtn(phone2, 'Contact Us');
    }
  }

  function hydrateGallery() {
    setText('wed6-gallery-title', getAttr('data-gallery-title', 'A Glimpse of Us'));

    for (var i = 1; i <= 5; i++) {
      var photo = document.getElementById('wed6-gallery-photo-' + i);
      var item = photo ? photo.closest('.wed6-gallery-item') : null;
      if (!photo) continue;

      var path = getAttr('data-gallery-' + i, '');
      var localSrc = photo.getAttribute('src') || '';

      if (path) {
        if (item) item.classList.remove('is-empty');
        photo.setAttribute('data-storage-path', path);
        photo.removeAttribute('data-token');
        applyFirebaseAsset(photo);
        continue;
      }

      photo.removeAttribute('data-storage-path');
      if (localSrc) {
        if (item) item.classList.remove('is-empty');
        continue;
      }

      photo.removeAttribute('src');
      if (item) item.classList.add('is-empty');
    }
  }

  function hydrate() {
    var groomName = getAttr('data-groom-name', '');
    var brideName = getAttr('data-bride-name', '');
    var dateRaw = getCalendarDateRaw();

    // Names are letter-filled when the intro animation starts
    setText('wed6-hero-groom', '');
    setText('wed6-hero-bride', '');
    setText('wed6-hero-date', formatHeroDate(dateRaw));
    setText('wed6-quote-text', '');
    setText('wed6-invitation-message', getAttr('data-invitation-message', ''));
    setText('wed6-welcome-text', getAttr('data-welcome-message', ''));
    if (body.classList.contains('wed6-closing-amp-newline')) {
      setText('wed6-closing-names', groomName + '\n&\n' + brideName);
    } else {
      setText('wed6-closing-names', groomName + ' & ' + brideName);
    }

    setText('wed6-details-groom-name', groomName);
    setText('wed6-details-bride-name', brideName);
    setText('wed6-details-groom-prefix', getAttr('data-groom-parent-prefix', ''));
    setText('wed6-details-bride-prefix', getAttr('data-bride-parent-prefix', ''));
    setHtml('wed6-details-groom-parents', formatParentsName(getAttr('data-groom-parents-name', '')));
    setHtml('wed6-details-bride-parents', formatParentsName(getAttr('data-bride-parents-name', '')));
    setText('wed6-details-groom-place', getAttr('data-groom-place', ''));
    setText('wed6-details-bride-place', getAttr('data-bride-place', ''));

    var eventDateOnly = dateRaw ? new Date(dateRaw + 'T00:00:00') : null;
    if (eventDateOnly && !isNaN(eventDateOnly.getTime())) {
      setText(
        'wed6-details-date-month',
        eventDateOnly.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
      );
      setText(
        'wed6-details-date-day',
        eventDateOnly.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
      );
      setText('wed6-details-date-number', String(eventDateOnly.getDate()));
    } else {
      setText('wed6-details-date-month', '');
      setText('wed6-details-date-day', '');
      setText('wed6-details-date-number', '');
    }
    setText('wed6-details-date-time', getTimeDisplayLabel(getAttr('data-event-time', '')));
    setText('wed6-details-event-venue', getAttr('data-event-address', ''));

    var blessingsFrom = getAttr('data-blessings-from', '');
    var blessingsEl = document.getElementById('wed6-blessings');
    if (blessingsFrom) {
      buildBlessingsNames(blessingsFrom);
      if (blessingsEl) blessingsEl.hidden = false;
    } else if (blessingsEl) {
      blessingsEl.hidden = true;
    }

    setText('wed6-rsvp-thanks-text', getAttr('data-rsvp-thank-you', 'Thank you for your response!'));

    document.title = groomName && brideName
      ? groomName + ' & ' + brideName + ' — Wedding Invitation'
      : document.title;

    hydrateSaveTheDate();
    hydrateCountdown();
    buildVenues();
    buildTimeline();
    hydrateContact();
    hydrateGallery();
  }

  function openCountdownCurtains() {
    var section = document.getElementById('wed6-countdown');
    if (!section || section.classList.contains('is-curtains-open')) return;
    section.classList.add('is-curtains-open');
  }

  function initCountdownCurtains() {
    var section = document.getElementById('wed6-countdown');
    if (!section) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      openCountdownCurtains();
      return;
    }

    if (!scrollPage) {
      openCountdownCurtains();
      return;
    }

    var opened = false;

    function isSectionAtViewportCenter() {
      var pageRect = scrollPage.getBoundingClientRect();
      var sectionRect = section.getBoundingClientRect();
      var viewCenter = pageRect.top + pageRect.height * 0.5;
      var sectionCenter = sectionRect.top + sectionRect.height * 0.5;
      var tolerance = Math.max(28, pageRect.height * 0.06);
      return Math.abs(sectionCenter - viewCenter) <= tolerance;
    }

    function maybeOpenCurtains() {
      if (opened) return;
      if (!isSectionAtViewportCenter()) return;
      opened = true;
      openCountdownCurtains();
      scrollPage.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }

    function onScroll() {
      maybeOpenCurtains();
    }

    maybeOpenCurtains();
    scrollPage.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function initScrollReveals() {
    var sections = document.querySelectorAll('.wed6-reveal');
    if (!sections.length) return;

    function registerRevealTargets(section) {
      if (!section) return;

      var selectorMap = {
        'wed6-quote': [],
        'wed6-calendar-section': [
          '.wed6-save-date-heading',
          '.wed6-save-date-frame'
        ],
        'wed6-details': [
          '.wed6-details-couple-frame',
          '.wed6-details-message',
          '#wed6-details-groom-name',
          '#wed6-details-groom-prefix',
          '#wed6-details-groom-parents',
          '#wed6-details-groom-place',
          '#wed6-details-bride-name',
          '#wed6-details-bride-prefix',
          '#wed6-details-bride-parents',
          '#wed6-details-bride-place',
          '#wed6-details-date-month',
          '#wed6-details-date-number',
          '#wed6-details-date-day',
          '#wed6-details-date-time',
          '#wed6-details-event-venue'
        ],
        'wed6-timeline': [
          '.wed6-section-title',
          '.wed6-timeline-plant'
        ],
        'wed6-venues': [
          '.wed6-section-title',
          '.wed6-venues-carousel'
        ],
        'wed6-rsvp': [
          '.wed6-section-title',
          '.wed6-rsvp-sub',
          '.wed6-rsvp-form .wed6-field:nth-of-type(1)',
          '.wed6-rsvp-form .wed6-field:nth-of-type(2)',
          '#wed6-rsvp-submit'
        ],
        'wed6-countdown': [
          '.wed6-countdown-content .wed6-section-title',
          '.wed6-countdown-date',
          '.wed6-countdown-grid'
        ],
        'wed6-contact': [
          '.wed6-section-title',
          '.wed6-contact-text',
          '.wed6-contact-actions > *'
        ],
        'wed6-welcome': [
          '.wed6-floral-divider:not(.wed6-floral-divider--bottom)',
          '.wed6-welcome-text',
          '.wed6-closing-top',
          '.wed6-closing-names',
          '.wed6-blessings-label',
          '.wed6-blessings-names',
          '.wed6-floral-divider--bottom'
        ]
      };

      var selectors = selectorMap[section.id] || ['.wed6-section-title'];
      var seen = [];
      var delayStep = 0.16;
      var index = 0;

      selectors.forEach(function (selector) {
        var matches = section.querySelectorAll(selector);
        Array.prototype.forEach.call(matches, function (el) {
          if (!el || seen.indexOf(el) !== -1) return;
          seen.push(el);
          el.classList.add('wed6-reveal-target');
          el.style.setProperty('--wed6-reveal-delay', (index * delayStep).toFixed(2) + 's');
          index += 1;
        });
      });
    }

    sections.forEach(function (el) {
      registerRevealTargets(el);
    });

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
        if (el.id === 'wed6-timeline') growTimelineStem();
        if (el.id === 'wed6-quote') startQuoteTypewriter();
      });
      openCountdownCurtains();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var viewportRatio = entry.rootBounds && entry.rootBounds.height
            ? entry.intersectionRect.height / entry.rootBounds.height
            : 0;
          var triggerRatio = 0.75;
          if (entry.target && entry.target.id === 'wed6-details') triggerRatio = 0.6;
          /* Quote can be short on screen; a high ratio often misses on mobile. */
          if (entry.target && entry.target.id === 'wed6-quote') triggerRatio = 0.22;

          if (entry.isIntersecting && (entry.intersectionRatio >= triggerRatio || viewportRatio >= triggerRatio)) {
            entry.target.classList.add('is-visible');
            if (entry.target.id === 'wed6-timeline') {
              growTimelineStem();
            }
            if (entry.target.id === 'wed6-quote') {
              startQuoteTypewriter();
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { root: scrollPage, rootMargin: '0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sections.forEach(function (el) { observer.observe(el); });
  }

  function startQuoteTypewriter() {
    var quoteEl = document.getElementById('wed6-quote-text');
    if (!quoteEl || quoteEl.dataset.typed === 'true') return;

    var fullQuote = getAttr('data-quote', '');
    if (!fullQuote) {
      quoteEl.dataset.typed = 'true';
      return;
    }

    quoteEl.dataset.typed = 'true';

    if (prefersReducedMotion()) {
      quoteEl.textContent = fullQuote;
      quoteEl.classList.remove('is-typing');
      quoteEl.classList.add('is-typed');
      return;
    }

    /* Reserve final height so the section does not jump while typing. */
    quoteEl.textContent = fullQuote;
    quoteEl.style.minHeight = quoteEl.offsetHeight + 'px';
    quoteEl.textContent = '';
    quoteEl.classList.add('is-typing');
    quoteEl.classList.remove('is-typed');

    var index = 0;
    var delayRaw = parseInt(getAttr('data-quote-type-delay', ''), 10);
    var baseDelay = !isNaN(delayRaw) && delayRaw > 0 ? delayRaw : 34;

    function typeNext() {
      if (index >= fullQuote.length) {
        quoteEl.classList.remove('is-typing');
        quoteEl.classList.add('is-typed');
        return;
      }

      quoteEl.textContent = fullQuote.slice(0, index + 1);
      var char = fullQuote.charAt(index);
      index += 1;

      var delay = baseDelay;
      if (char === ' ') delay = Math.max(12, Math.round(baseDelay * 0.55));
      else if (char === ',' || char === ';' || char === ':') delay = Math.round(baseDelay * 3.5);
      else if (char === '.' || char === '!' || char === '?') delay = Math.round(baseDelay * 5.3);

      window.setTimeout(typeNext, delay);
    }

    window.setTimeout(typeNext, 220);
  }

  function clamp01(value) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  function getGalleryZoomProgress(track, stage) {
    if (!track || !stage || !scrollPage) return 0;
    var pageRect = scrollPage.getBoundingClientRect();
    var trackRect = track.getBoundingClientRect();
    var trackTop = trackRect.top - pageRect.top + scrollPage.scrollTop;
    var maxScroll = Math.max(1, track.offsetHeight - stage.offsetHeight);
    return clamp01((scrollPage.scrollTop - trackTop) / maxScroll);
  }

  function initGalleryZoom() {
    var track = document.getElementById('wed6-gallery-track');
    var stage = document.getElementById('wed6-gallery-stage');
    var cluster = document.getElementById('wed6-gallery-cluster');
    var decor = stage ? stage.querySelector('.wed6-gallery-decor') : null;
    if (!track || !stage || !cluster || !scrollPage) return;

    var ZOOM_MAX = 2.05;
    var ticking = false;
    var curves = decor
      ? Array.prototype.slice.call(decor.querySelectorAll('.wed6-gallery-curve'))
      : [];

    /* Per-curve drift (px) + base rotation — parallax as gallery scrubs. */
    var curveMotion = [
      { x: -28, y: 46, rot: -12 },
      { x: 36, y: 30, rot: 8 },
      { x: -18, y: -40, rot: 16 },
      { x: 32, y: -48, rot: -18 },
      { x: -40, y: 22, rot: 4 },
      { x: 20, y: 52, rot: -6 },
      { x: 44, y: -26, rot: 22 },
      { x: 26, y: -36, rot: -10 },
      { x: -12, y: -54, rot: -28 },
      { x: 16, y: -44, rot: 12 }
    ];

    function applyZoom(progress) {
      var zoom = 1 + progress * (ZOOM_MAX - 1);
      cluster.style.setProperty('--wed6-gallery-zoom', zoom.toFixed(4));

      curves.forEach(function (curve, i) {
        var motion = curveMotion[i] || curveMotion[0];
        var tx = (motion.x * progress).toFixed(2);
        var ty = (motion.y * progress).toFixed(2);
        curve.style.transform =
          'translate(' + tx + 'px, ' + ty + 'px) rotate(' + motion.rot + 'deg)';
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        applyZoom(getGalleryZoomProgress(track, stage));
      });
    }

    if (prefersReducedMotion()) {
      applyZoom(0);
      return;
    }

    applyZoom(getGalleryZoomProgress(track, stage));
    scrollPage.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function initGalleryReveal() {
    var section = document.getElementById('wed6-together');
    if (!section) return;

    var items = Array.prototype.slice.call(
      section.querySelectorAll('.wed6-gallery-item:not(.is-empty)')
    );
    if (!items.length) return;

    function assignRandomRevealOrder() {
      var order = items.slice();
      var i;

      for (i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }

      order.forEach(function (item, index) {
        item.style.setProperty('--wed6-gallery-delay', (index * 0.4).toFixed(2) + 's');
      });
    }

    assignRandomRevealOrder();

    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      section.classList.add('is-gallery-visible');
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var viewportRatio = entry.rootBounds && entry.rootBounds.height
            ? entry.intersectionRect.height / entry.rootBounds.height
            : 0;

          if (entry.isIntersecting && (entry.intersectionRatio >= 0.35 || viewportRatio >= 0.35)) {
            section.classList.add('is-gallery-visible');
            observer.unobserve(section);
          }
        });
      },
      { root: scrollPage, rootMargin: '0px', threshold: [0, 0.15, 0.35, 0.5, 0.75, 1] }
    );

    observer.observe(section);
  }

  function initRsvp() {
    if (getAttr('data-rsvp-enabled', 'true') === 'false') {
      var rsvpSection = document.getElementById('wed6-rsvp');
      if (rsvpSection) rsvpSection.hidden = true;
      return;
    }

    var form = document.getElementById('wed6-rsvp-form');
    var heartsLayer = document.getElementById('wed6-rsvp-hearts');
    if (!form) return;

    if (heartsLayer && heartsLayer.parentNode !== document.body) {
      document.body.appendChild(heartsLayer);
    }

    function playRsvpHearts() {
      if (!heartsLayer) return;
      heartsLayer.innerHTML = '';
      var shades = ['#c99a72', '#b0765a', '#a07d5c', '#d4b08a', '#8a6650'];

      for (var i = 0; i < 18; i++) {
        var heart = document.createElement('span');
        heart.className = 'wed6-rsvp-heart';
        heart.textContent = i % 3 === 0 ? '♡' : '♥';
        heart.style.left = (6 + Math.random() * 88).toFixed(2) + '%';
        heart.style.animationDuration = (3.6 + Math.random() * 1.8).toFixed(2) + 's';
        heart.style.animationDelay = (Math.random() * 0.55).toFixed(2) + 's';
        heart.style.fontSize = (0.95 + Math.random() * 0.8).toFixed(2) + 'rem';
        heart.style.color = shades[i % shades.length];
        heart.style.setProperty('--wed6-heart-drift', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
        heart.style.setProperty('--wed6-heart-spin', ((Math.random() - 0.5) * 260).toFixed(0) + 'deg');
        heartsLayer.appendChild(heart);
      }

      window.setTimeout(function () {
        if (heartsLayer) heartsLayer.innerHTML = '';
      }, 6500);
    }

    if (window.RsvpForm && window.RsvpStore) {
      var rsvpMode = getAttr('data-rsvp-mode', '');
      var rsvpConfig = {
        formId: 'wed6-rsvp-form',
        nameInputId: 'wed6-rsvp-name',
        reasonWrapId: 'wed6-rsvp-reason-wrap',
        reasonInputId: 'wed6-rsvp-reason',
        submitButtonId: 'wed6-rsvp-submit',
        thanksId: 'wed6-rsvp-thanks',
        thanksTextId: 'wed6-rsvp-thanks-text',
        getInviteMeta: function () {
          return {
            slug: getAttr('data-rsvp-slug', ''),
            groomName: getAttr('data-groom-name', ''),
            brideName: getAttr('data-bride-name', ''),
            displayName: getAttr('data-groom-name', '') + ' & ' + getAttr('data-bride-name', ''),
            templateId: getAttr('data-template-id', 'wedding-t6')
          };
        },
        getSuccessMessage: function () {
          return getAttr('data-rsvp-thank-you', 'Thank you for your response!');
        },
        onAttendYes: playRsvpHearts
      };

      if (rsvpMode === 'wishes') {
        rsvpConfig.mode = 'wishes';
      } else {
        rsvpConfig.guestsWrapId = 'wed6-rsvp-guests-wrap';
        rsvpConfig.guestsInputId = 'wed6-rsvp-guests';
        rsvpConfig.decreaseBtnId = 'wed6-rsvp-guests-decrease';
        rsvpConfig.increaseBtnId = 'wed6-rsvp-guests-increase';
        rsvpConfig.attendanceSelector = 'input[name="attendance"]';
      }

      window.RsvpForm.init(rsvpConfig);
    }
  }

  function initializeFirebaseImages() {
    /* Intro video first — often already started via inline src / preload. */
    if (introVideo && introVideo.getAttribute('data-storage-path')) {
      applyFirebaseAsset(introVideo);
    }

    document.querySelectorAll(
      'img[data-storage-path], video[data-storage-path], audio source[data-storage-path]'
    ).forEach(function (el) {
      if (el === introVideo) return;
      var path = el.getAttribute('data-storage-path');
      if (path) applyFirebaseAsset(el);
    });
  }

  function runFirebaseInit() {
    initializeFirebaseAudio();
    initializeFirebaseImages();
    if (window.FirebaseConfig && window.FirebaseConfig.storageBaseUrl) return;
    var check = setInterval(function () {
      if (window.FirebaseConfig && window.FirebaseConfig.storageBaseUrl) {
        clearInterval(check);
        initializeFirebaseAudio();
        initializeFirebaseImages();
      }
    }, 100);
    setTimeout(function () { clearInterval(check); }, 12000);
  }

  /* ---- Evoke editor live-preview bridge -----------------------------------
   * The editor embeds this template and streams the user's form data in via
   * postMessage. We map the section-keyed data onto the body's data-* attributes
   * the template already reads, re-run hydrate(), and (only in the editor) skip
   * the door-open intro so edits are immediately visible.
   */
  function initEvokeBridge() {
    var ATTR_MAP = {
      'couple.groomName': 'data-groom-name',
      'couple.brideName': 'data-bride-name',
      'couple.groomParentPrefix': 'data-groom-parent-prefix',
      'couple.groomParentsName': 'data-groom-parents-name',
      'couple.brideParentPrefix': 'data-bride-parent-prefix',
      'couple.brideParentsName': 'data-bride-parents-name',
      'couple.groomPlace': 'data-groom-place',
      'couple.bridePlace': 'data-bride-place',
      'ceremony.date': 'data-event-date',
      'ceremony.time': 'data-event-time',
      'ceremony.address': 'data-event-address',
      'ceremony.mapLink': 'data-map-link',
      'ceremony.mapEmbed': 'data-map-embed',
      'messages.quote': 'data-quote',
      'messages.togetherQuote': 'data-together-quote',
      'messages.invitationMessage': 'data-invitation-message',
      'messages.welcomeMessage': 'data-welcome-message',
      'messages.blessingsFrom': 'data-blessings-from',
      'contact.phone': 'data-contact-phone',
      'contact.phone2': 'data-contact-phone-2',
      'gallery.title': 'data-gallery-title',
      'rsvp.thankYou': 'data-rsvp-thank-you'
    };

    var revealed = false;
    function revealForEditor() {
      if (revealed) return;
      revealed = true;
      var op = document.getElementById('wed6-session-opening');
      if (op) { op.setAttribute('hidden', ''); op.style.display = 'none'; }
      var inv = document.getElementById('wed6-session-invite');
      if (inv) {
        inv.removeAttribute('hidden');
        inv.classList.add('is-active');
        inv.style.opacity = '1';
        inv.style.visibility = 'visible';
      }
      try { unlockInviteScroll(); } catch (e) {}
    }

    function apply(data) {
      if (!data || typeof data !== 'object') return;

      Object.keys(ATTR_MAP).forEach(function (path) {
        var parts = path.split('.');
        var sec = data[parts[0]];
        if (!sec || typeof sec !== 'object') return;
        var v = sec[parts[1]];
        if (v === undefined) return;
        body.setAttribute(ATTR_MAP[path], v == null ? '' : String(v));
      });

      // Timeline -> data-event-N-title/date/time (5 slots).
      var tl = (data.timeline && data.timeline.items) || null;
      if (Array.isArray(tl)) {
        for (var i = 0; i < 5; i++) {
          var it = tl[i] || {};
          body.setAttribute('data-event-' + (i + 1) + '-title', it.title ? String(it.title) : '');
          body.setAttribute('data-event-' + (i + 1) + '-date', it.date ? String(it.date) : '');
          body.setAttribute('data-event-' + (i + 1) + '-time', it.time ? String(it.time) : '');
        }
      }

      // Venues -> data-venue-count + data-venue-N-*.
      var vn = (data.venues && data.venues.items) || null;
      if (Array.isArray(vn)) {
        var vis = vn.filter(function (x) { return x && (x.label || x.address); });
        body.setAttribute('data-venue-count', String(vis.length));
        for (var j = 0; j < vis.length; j++) {
          var vv = vis[j];
          body.setAttribute('data-venue-' + (j + 1) + '-label', vv.label ? String(vv.label) : '');
          body.setAttribute('data-venue-' + (j + 1) + '-address', vv.address ? String(vv.address) : '');
          body.setAttribute('data-venue-' + (j + 1) + '-map-embed', vv.mapEmbed ? String(vv.mapEmbed) : '');
          body.setAttribute('data-venue-' + (j + 1) + '-map-link', vv.mapLink ? String(vv.mapLink) : '');
        }
      }

      hydrate();

      // Hero names + quote are letter-filled on the intro animation; show them
      // directly for the editor preview.
      setText('wed6-hero-groom', getAttr('data-groom-name', ''));
      setText('wed6-hero-bride', getAttr('data-bride-name', ''));
      setText('wed6-quote-text', getAttr('data-quote', ''));

      // Gallery: set uploaded/URL images directly (bypass the Firebase resolver).
      var gl = (data.gallery && data.gallery.items) || null;
      if (Array.isArray(gl)) {
        for (var k = 0; k < 5; k++) {
          var ph = document.getElementById('wed6-gallery-photo-' + (k + 1));
          if (!ph) continue;
          var src = gl[k] && gl[k].image ? String(gl[k].image) : '';
          var item = ph.closest ? ph.closest('.wed6-gallery-item') : null;
          if (src) {
            ph.removeAttribute('data-storage-path');
            ph.removeAttribute('data-token');
            ph.src = src;
            if (item) item.classList.remove('is-empty');
          }
        }
      }

      revealForEditor();
    }

    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.channel === 'evoke:preview-update' && e.data.version === 1) {
        apply(e.data.data);
      }
    });

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ channel: 'evoke:preview-ready', version: 1 }, '*');
      }
    } catch (_) {}
  }

  /* Boot */
  hydrate();
  runFirebaseInit();
  initMute();
  initOpening();
  warmIntroVideoBuffer();
  initScrollHint();
  initScrollReveals();
  initCountdownCurtains();
  initGalleryReveal();
  initGalleryZoom();
  startCountdown();
  initRsvp();
  initEvokeBridge();
})();
