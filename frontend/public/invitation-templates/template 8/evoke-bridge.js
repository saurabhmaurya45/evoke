/**
 * Evoke editor live-preview bridge for the Royal Gate (template 8) wedding page.
 *
 * This page is a React app, so editor data is not written onto DOM hooks: it is handed to the
 * content store (js/content.js), which merges it over defaults.json and re-renders the
 * components that read from it.
 */
import { setData } from './js/content.js';

const UPDATE = 'evoke:preview-update';
const READY = 'evoke:preview-ready';
const VERSION = 1;
const PARENT_ORIGIN = document.referrer ? new URL(document.referrer).origin : window.location.origin;

window.addEventListener('message', (e) => {
  if (
    e &&
    e.source === window.parent &&
    e.origin === PARENT_ORIGIN &&
    e.data &&
    e.data.channel === UPDATE &&
    e.data.version === VERSION
  ) {
    setData(e.data.data);
  }
});

try {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ channel: READY, version: VERSION }, PARENT_ORIGIN);
  }
} catch (_) {}
