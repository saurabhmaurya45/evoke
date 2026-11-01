/**
 * Starts a template's background music by default.
 *
 * Browsers refuse to play sound until the visitor has interacted with the page, so this tries
 * straight away and then again on each interaction until the music is playing. Pressing the music
 * button itself ends this, so the button's own handler decides what happens.
 *
 *   var start = evokeAutoMusic({ audio: fn, toggle: fn, onPlaying: fn });
 *   start();  // call again when the track changes
 */
(function () {
  'use strict';

  var EVENTS = ['click', 'touchend', 'keydown', 'pointerup'];

  window.evokeAutoMusic = function (options) {
    var done = false;

    function stop() {
      done = true;
      EVENTS.forEach(function (name) {
        document.removeEventListener(name, onGesture, true);
      });
    }

    function attempt() {
      if (done) return;
      var audio = options.audio();
      if (!audio || !audio.getAttribute('src')) return;
      if (!audio.paused) return stop();
      var playing = audio.play();
      if (!playing || !playing.then) return;
      playing
        .then(function () {
          stop();
          if (options.onPlaying) options.onPlaying();
        })
        .catch(function () {});
    }

    function onGesture(event) {
      var toggle = options.toggle && options.toggle();
      if (toggle && event.target && toggle.contains(event.target)) return stop();
      attempt();
    }

    EVENTS.forEach(function (name) {
      document.addEventListener(name, onGesture, true);
    });
    attempt();
    return attempt;
  };
})();
