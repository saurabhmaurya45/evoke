/*
 * Evoke content store for the Royal Gate (template 8) invitation.
 *
 * The page is a React app, so instead of patching DOM nodes (React would overwrite them on the
 * next render) every component reads its copy and media from this store. `defaults.json` is the
 * single source of truth for the sample content; editor data arrives through evoke-bridge.js
 * (`evoke:preview-update`), is merged section-by-section over the defaults, and every mounted
 * component re-renders via `useContent()`.
 */
import { n as toESM } from './rolldown-runtime-Bh1tDfsg.js';
import { c as reactModule } from './react-CC4f5wG5.js';

const React = toESM(reactModule(), 1);

let defaults = {};
let current = {};
let pending = null;
let loaded = false;
const listeners = new Set();

function merge(base, data) {
  const out = {};
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(data || {})]);
  keys.forEach((key) => {
    const b = base && base[key] && typeof base[key] === 'object' ? base[key] : {};
    const d = data && data[key];
    out[key] = d && typeof d === 'object' && !Array.isArray(d) ? { ...b, ...stripUndefined(d) } : { ...b };
  });
  return out;
}

function stripUndefined(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  });
  return out;
}

/** Loads defaults.json (relative to the page) once, before the app mounts. */
export async function loadDefaults() {
  try {
    const res = await fetch('defaults.json', { cache: 'no-store' });
    defaults = res.ok ? await res.json() : {};
  } catch (_) {
    defaults = {};
  }
  loaded = true;
  current = merge(defaults, pending);
}

/** Applies editor data (section-keyed) and re-renders every subscribed component. */
export function setData(data) {
  if (!data || typeof data !== 'object') return;
  pending = data;
  if (!loaded) return;
  current = merge(defaults, data);
  listeners.forEach((fn) => fn());
}

/** Hook: subscribe the calling component to content changes and return the merged content. */
export function useContent() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => listeners.delete(force);
  }, []);
  return current;
}

/** Only http(s), same-origin paths and inline image/audio/video data URLs are allowed as media. */
export function isSafeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const v = value.trim();
  if (/^data:(image|audio|video)\/[a-z0-9.+-]+;base64,/i.test(v)) return true;
  try {
    const url = new URL(v, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/** A media URL from content, falling back to the default when blank or unsafe. */
export function media(section, key) {
  const value = current[section] && current[section][key];
  if (isSafeUrl(value)) return value;
  const fallback = defaults[section] && defaults[section][key];
  return isSafeUrl(fallback) ? fallback : '';
}

/** Same as media() but for a field inside a list item, falling back to the default item at `index`. */
export function itemMedia(section, list, index, key) {
  const items = (current[section] && current[section][list]) || [];
  const value = items[index] && items[index][key];
  if (isSafeUrl(value)) return value;
  const defItems = (defaults[section] && defaults[section][list]) || [];
  const fallback = defItems[index] && defItems[index][key];
  return isSafeUrl(fallback) ? fallback : '';
}

/** A list from content: the editor's list when it sends one, otherwise the default list. */
export function list(section, key) {
  const value = current[section] && current[section][key];
  if (Array.isArray(value)) return value;
  const fallback = defaults[section] && defaults[section][key];
  return Array.isArray(fallback) ? fallback : [];
}

/** Multi-line text -> children array with <br/> between lines. */
export function lines(text, runtime) {
  const parts = String(text == null ? '' : text).split(/\r?\n/);
  const out = [];
  parts.forEach((part, i) => {
    if (i) out.push(runtime.jsx('br', {}, 'br' + i));
    out.push(part);
  });
  return out;
}

/** Countdown target (ms) from countdown.date (YYYY-MM-DD) + countdown.time (HH:MM, local). */
export function countdownTarget() {
  const c = current.countdown || {};
  const time = /^\d{1,2}:\d{2}$/.test(String(c.time || '').trim()) ? String(c.time).trim().padStart(5, '0') : '09:00';
  const when = new Date(String(c.date || '') + 'T' + time + ':00');
  return isNaN(when.getTime()) ? 0 : when.getTime();
}

/** RSVP: when the couple set a WhatsApp number, open WhatsApp with the guest's response filled in. */
export function sendRsvp(payload) {
  const r = current.rsvp || {};
  const digits = String(r.whatsapp || '').replace(/[^\d]/g, '');
  if (!digits) return false;
  const names = [current.couple && current.couple.groomName, current.couple && current.couple.brideName].filter(Boolean).join(' & ');
  const text = [
    'RSVP' + (names ? ' — ' + names : ''),
    'Name: ' + payload.fullName,
    'Events: ' + (payload.events || []).join(', '),
    payload.guests ? 'Guests: ' + payload.guests : '',
    payload.message ? 'Message: ' + payload.message : '',
  ].filter(Boolean).join('\n');
  try {
    window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  } catch (_) {}
  return true;
}
