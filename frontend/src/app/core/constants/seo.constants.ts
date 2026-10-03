import { CONTACT_INSTAGRAM } from './app.constants';

/**
 * SEO keyword strategy — India-first, occasion-led.
 *
 * Deliberately brand-neutral: no keyword here contains the company name, so a
 * rebrand touches APP_NAME only. Grouped by occasion because the long-term
 * plan is one landing page per occasion (/wedding-invitations,
 * /birthday-invitations, …), each targeting its own cluster. Search intent in
 * India skews heavily toward "card" and "WhatsApp" phrasing rather than the
 * Western "wedding website", and toward vernacular occasion names — those are
 * the terms with volume, so they lead.
 */

/**
 * Product-led terms. "Invitation website" is the product itself and is far
 * less contested than the "card" head terms the incumbents own, so the
 * homepage leads with these (keyword analysis: docs/seo/keyword-analysis.md).
 */
export const WEBSITE_KEYWORDS: readonly string[] = [
  'wedding invitation website',
  'online wedding invitation',
  'digital wedding invitation India',
  'wedding website India',
  'e invite for wedding',
  'wedding invitation with RSVP',
  'invitation with google map location',
  'wedding invitation with music and photos',
  'wedding countdown website',
];

/** Sharing-led terms — Indian guests receive invitations on WhatsApp. */
export const WHATSAPP_KEYWORDS: readonly string[] = [
  'whatsapp wedding invitation',
  'wedding invitation link for whatsapp',
  'digital invitation card for whatsapp',
  'shaadi invitation card online',
];

/** Long-tail community clusters, one landing page each. */
export const COMMUNITY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  punjabi: ['punjabi wedding invitation', 'punjabi wedding card online', 'punjabi shaadi invitation'],
  sikh: ['sikh wedding invitation', 'anand karaj invitation card', 'sikh wedding card online'],
  'muslim-nikah': ['nikah invitation online', 'muslim wedding invitation', 'nikah card for whatsapp'],
  hindu: ['hindu wedding invitation', 'hindu wedding card online', 'vivah invitation card'],
  'south-indian': ['south indian wedding invitation', 'tamil wedding invitation online', 'temple wedding invitation'],
  christian: ['christian wedding invitation', 'church wedding invitation online', 'christian wedding card'],
};

/** Template-led terms for the gallery and per-template pages. */
export const TEMPLATE_KEYWORDS: readonly string[] = [
  'wedding invitation templates online',
  'royal wedding invitation design',
  'traditional wedding invitation template',
  'wedding invitation website template',
];

/** Site-wide terms — the homepage and generic pages compete on these. */
export const CORE_KEYWORDS: readonly string[] = [
  'digital invitation card',
  'online invitation maker India',
  'e invitation card maker',
  'whatsapp invitation card',
  'invitation website maker',
  'create invitation card online',
  'digital invite India',
  'e-card invitation online',
  'custom invitation website',
  'paperless invitation India',
];

/**
 * Per-occasion clusters. Head term first, then the long-tail and vernacular
 * variants that convert — including the ceremony names Indian customers
 * actually search for.
 */
export const OCCASION_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  wedding: [
    'wedding invitation card online',
    'digital wedding invitation India',
    'shaadi invitation card',
    'wedding website India',
    'e wedding invitation card',
    'wedding invitation video',
    'save the date card online',
    'haldi invitation card',
    'mehndi invitation card',
    'sangeet invitation card',
    'reception invitation card',
    'hindu wedding invitation card',
    'muslim nikah invitation card',
    'sikh anand karaj invitation',
    'christian wedding invitation card',
    'marathi lagna patrika online',
    'tamil wedding invitation card',
    'telugu wedding invitation card',
    'bengali biye invitation card',
    'gujarati kankotri online',
    'wedding invitation card in hindi',
    'royal wedding invitation card design',
  ],
  engagement: [
    'engagement invitation card',
    'ring ceremony invitation card',
    'sagai invitation card online',
    'roka ceremony invitation',
    'engagement e invite',
    'digital engagement invitation',
  ],
  birthday: [
    'birthday invitation card maker',
    'online birthday invitation India',
    'first birthday invitation card',
    'kids birthday invitation card',
    'birthday invitation card in hindi',
    'birthday party invitation video',
    'digital birthday invite whatsapp',
  ],
  babyShower: [
    'baby shower invitation card',
    'godh bharai invitation card',
    'seemantham invitation card',
    'valaikappu invitation card',
    'naming ceremony invitation card',
    'namkaran invitation card',
    'annaprashan invitation card',
    'cradle ceremony invitation',
  ],
  housewarming: [
    'housewarming invitation card',
    'griha pravesh invitation card',
    'gruhapravesham invitation card',
    'new home puja invitation',
  ],
  festival: [
    'festival invitation card',
    'diwali party invitation card',
    'navratri garba invitation card',
    'ganesh chaturthi invitation card',
    'pongal invitation card',
    'onam celebration invitation',
    'puja invitation card online',
    'satyanarayan puja invitation',
  ],
  ceremony: [
    'thread ceremony invitation card',
    'upanayanam invitation card',
    'munj invitation card',
    'mundan ceremony invitation',
    'retirement party invitation card',
    'anniversary invitation card',
    'silver jubilee invitation card',
  ],
  corporate: [
    'corporate event invitation',
    'office party invitation card',
    'conference invitation online',
    'store opening invitation card',
  ],
};

/** Commercial-intent modifiers worth pairing with occasion heads. */
export const INTENT_KEYWORDS: readonly string[] = [
  'free invitation card maker',
  'invitation card design price',
  'best invitation website India',
  'invitation card with rsvp',
  'invitation with google maps location',
];

/**
 * Homepage keyword set: the product and WhatsApp clusters first (where a new
 * domain can win), then the generic card terms and live occasion head terms.
 */
export const HOME_KEYWORDS: readonly string[] = [
  ...WEBSITE_KEYWORDS.slice(0, 5),
  ...WHATSAPP_KEYWORDS.slice(0, 2),
  ...CORE_KEYWORDS.slice(0, 4),
  OCCASION_KEYWORDS['wedding'][0],
  OCCASION_KEYWORDS['engagement'][0],
];


/** Company details used in structured data. Update alongside a rebrand. */
export const ORGANISATION = {
  legalName: 'theinvitely.in',
  areaServed: 'IN',
  currency: 'INR',
  language: 'en-IN',
  sameAs: [CONTACT_INSTAGRAM] as readonly string[],
} as const;
