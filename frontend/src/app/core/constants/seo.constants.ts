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

/** Flattened homepage keyword set: core terms plus each occasion's head term. */
export const HOME_KEYWORDS: readonly string[] = [
  ...CORE_KEYWORDS,
  ...Object.values(OCCASION_KEYWORDS).map((cluster) => cluster[0]),
];

/** Company details used in structured data. Update alongside a rebrand. */
export const ORGANISATION = {
  legalName: 'Evoke',
  areaServed: 'IN',
  currency: 'INR',
  language: 'en-IN',
  sameAs: [] as readonly string[],
} as const;
