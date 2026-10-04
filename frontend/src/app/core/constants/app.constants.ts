/** Immutable brand + product constants. */
export const APP_NAME = 'theinvitely.in';

export const APP_TAGLINE = 'Create Beautiful Invitation Websites in Minutes';

/**
 * Doubles as the homepage meta description (≤155 chars), so it leads with the
 * terms people search for: wedding invitation website, RSVP, WhatsApp.
 */
export const APP_DESCRIPTION =
  'Create a beautiful wedding invitation website with photos, music, venue map & RSVP. Share one link on WhatsApp. Ready in minutes.';

/** Absolute logo URL for structured data (Organization.logo). */
export const APP_LOGO_PATH = '/assets/brand/logo.png';

/**
 * Desktop nav (logo + six links + actions) needs about 1100px before the
 * items collide. Below this width the header uses the menu button.
 */
export const BREAKPOINT_NAV = 1180; // Keep in step with $nav-collapse in navbar.component.scss.

export const COPYRIGHT_YEAR = 2026;

export const CONTACT_EMAIL = 'theinvitely@gmail.com';

/** Display form of the public support number. */
export const CONTACT_PHONE = '+91 79859 81123';

/** E.164 form used by `tel:` links. */
export const CONTACT_PHONE_TEL = '+917985981123';

/** Opens a WhatsApp chat with the public support number, pre-filled with `message`. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${CONTACT_PHONE_TEL.slice(1)}?text=${encodeURIComponent(message)}`;
}

/** Opens a WhatsApp chat with the public support number. */
export const CONTACT_WHATSAPP = whatsappLink('Hi, I would like to know more about theinvitely.in');

export const CONTACT_INSTAGRAM = 'https://www.instagram.com/theinvitely.in/';
