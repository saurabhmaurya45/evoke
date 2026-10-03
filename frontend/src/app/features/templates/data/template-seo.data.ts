/**
 * Search-facing copy for each template's own page (/templates/:slug).
 *
 * Kept apart from HomeContentService because it is long-form marketing copy,
 * not card data. Keyed by `slotId`; `slug` is the public URL segment and must
 * never change once indexed (add a redirect if it ever has to).
 *
 * Descriptions are written from what each template actually renders — keep
 * them in step with the template if its sections change.
 */
export interface TemplateSeo {
  readonly slotId: string;
  readonly slug: string;
  /** Short occasion/community label, e.g. "Sikh Wedding". Used in titles and card subtitles. */
  readonly label: string;
  /** Landing-page slugs (see landing-pages.data.ts) this template belongs to. */
  readonly communities: readonly string[];
  readonly keywords: readonly string[];
  /** One sentence; becomes the meta description (≤155 chars). */
  readonly summary: string;
  readonly paragraphs: readonly string[];
  /** What guests actually see, in order. */
  readonly highlights: readonly string[];
}

export const TEMPLATE_SEO: readonly TemplateSeo[] = [
  {
    slotId: 'tpl-samarpan-royal',
    slug: 'samarpan-royal-union',
    label: 'Royal Hindu Wedding',
    communities: ['hindu'],
    keywords: [
      'royal wedding invitation',
      'hindu wedding invitation website',
      'udaipur wedding invitation',
    ],
    summary:
      'Samarpan is a royal maroon-and-gold wedding invitation website with a live countdown, love story and RSVP — made for palace and heritage weddings.',
    paragraphs: [
      'Samarpan opens on a deep maroon stage lit in gold, with your names set in classic serif type and a line of blessing beneath them. Two clear buttons — RSVP and View Invitation — sit right on the first screen, so guests know exactly what to do.',
      'Scroll down and a live “Days Until Forever” countdown ticks towards your wedding, followed by a “When Two Paths Meet” story section where you can tell how you met. It suits palace weddings in Udaipur and Jaipur, heritage hotels and any celebration that wants a regal, traditional feel.',
    ],
    highlights: [
      'Royal maroon & gold opening screen',
      'RSVP button on the first screen',
      'Live wedding countdown',
      'Your love story',
      'Event list with dates and venues',
    ],
  },
  {
    slotId: 'tpl-eternal-bond',
    slug: 'eternal-bond-royal-wedding',
    label: 'Royal Wedding',
    communities: ['hindu'],
    keywords: [
      'wedding invitation with venue map',
      'haldi mehendi sangeet invitation',
      'envelope wedding invitation online',
    ],
    summary:
      'Eternal Bond opens like a real envelope, then shows your story, every function from haldi to reception, a Google Map of the venue and a photo gallery.',
    paragraphs: [
      'Guests tap the wax seal and a golden envelope opens on their screen, revealing your names. Floating petals, soft lights and a music toggle make the first few seconds feel like opening a printed card — without the courier.',
      'Inside, Eternal Bond walks through Our Story, a Wedding Festivities section for each function (haldi, mehendi, sangeet, wedding and reception), the venue with an embedded Google Map and a “View on Google Maps” button, and a Moments gallery for your pre-wedding photos.',
    ],
    highlights: [
      'Tap-to-open envelope with wax seal',
      'Background music toggle',
      'Haldi, mehendi, sangeet, wedding & reception',
      'Embedded Google Map of the venue',
      'Photo gallery',
    ],
  },
  {
    slotId: 'tpl-beloved-nikkah',
    slug: 'beloved-nikkah-invitation',
    label: 'Nikah',
    communities: ['muslim-nikah'],
    keywords: [
      'nikah invitation online',
      'muslim wedding invitation website',
      'nikah card for whatsapp',
    ],
    summary:
      'Beloved is an elegant Nikah invitation website with a save-the-date seal, Quranic verse, family names, event timeline, venue map and photo gallery.',
    paragraphs: [
      'Beloved begins with a “Save the Date” wax seal on soft ivory. One tap reveals a floral illustration of the couple and an elegant script introduction, with room for a Quranic verse such as “And among His signs is that He created for you mates from among yourselves.”',
      'Below, you can add both families’ names, a timeline for the Nikah, Walima and other events, the venue with a Google Maps button, a countdown and a polaroid-style photo gallery. It works beautifully for Nikah ceremonies, Walima receptions and Muslim weddings across India.',
    ],
    highlights: [
      'Save-the-date wax seal opening',
      'Space for a Quranic verse',
      'Bride’s and groom’s family details',
      'Event timeline with venue map',
      'Countdown and polaroid gallery',
    ],
  },
  {
    slotId: 'tpl-rosewood-punjabi',
    slug: 'rosewood-punjabi-wedding',
    label: 'Punjabi Wedding',
    communities: ['punjabi', 'hindu'],
    keywords: ['punjabi wedding invitation', 'punjabi wedding card online', 'pheras invitation'],
    summary:
      'Rosewood is a vibrant Punjabi wedding invitation website: a floral mandap scene, family blessings and a card for every function from haldi to pheras.',
    paragraphs: [
      'Rosewood opens on an illustrated mandap covered in pink flowers, with a petal-strewn aisle leading to your names — “Arjun weds Priya” style. It is bright, celebratory and unmistakably Punjabi.',
      'Families can add blessings from elders and both sets of parents, then each function gets its own illustrated card with date, time, venue and a directions link: haldi, mehendi, cocktail, engagement and the vivah pheras. Guests see the whole shaadi schedule in one scroll.',
    ],
    highlights: [
      'Illustrated floral mandap opening',
      'Family blessings from elders',
      'Separate card for haldi, mehendi, cocktail, engagement & pheras',
      'Directions link for each venue',
    ],
  },
  {
    slotId: 'tpl-maroon-gold-royal',
    slug: 'maroon-gold-royal-hindu-wedding',
    label: 'Hindu Wedding',
    communities: ['hindu'],
    keywords: [
      'hindu wedding invitation',
      'shri ganeshay namah wedding invitation',
      'wedding invitation with music',
    ],
    summary:
      'Maroon & Gold is a Hindu wedding invitation website opening with Shri Ganeshay Namah, with music, a countdown, every ceremony and couple profiles.',
    paragraphs: [
      'Maroon & Gold begins with the invocation “|| Shri Ganeshay Namah ||”, a Ganesha emblem and your names in flowing script, followed by a date chip and a “Click to play music” prompt so your chosen song starts as guests read.',
      'The page continues with a countdown to the wedding day, the main ceremony, and every event — haldi, mehndi, sangeet, ring ceremony, mangal phera and reception. A “Know Us” section introduces the bride and groom, and “Our Beautiful Moments” shows your photos.',
    ],
    highlights: [
      'Shri Ganeshay Namah invocation',
      'Tap-to-play background music',
      'Countdown to the wedding day',
      'Haldi, mehndi, sangeet, ring ceremony, phera & reception',
      'Bride & groom profiles and photo gallery',
    ],
  },
  {
    slotId: 'tpl-doorway-modern',
    slug: 'doorway-modern-wedding',
    label: 'Modern Wedding',
    communities: [],
    keywords: [
      'modern wedding invitation website',
      'interactive wedding invitation',
      'wedding invitation with rsvp',
    ],
    summary:
      'Doorway is an interactive modern wedding invitation: guests knock on a carved wooden door to enter, then see your timeline, venues, gallery and RSVP.',
    paragraphs: [
      'Doorway turns opening your invitation into a moment. Guests see a carved wooden door framed by flowers and knock to open it — a playful, memorable welcome that guests talk about.',
      'Behind the door are the couple’s and parents’ names, a welcome message, a timeline of events, venue details with maps, a photo gallery, contact numbers and an RSVP section. It suits couples who want something modern and a little different.',
    ],
    highlights: [
      'Knock-to-open wooden door',
      'Welcome message and family names',
      'Timeline of events',
      'Venues with maps',
      'Gallery, contacts and RSVP',
    ],
  },
  {
    slotId: 'tpl-golden-promise',
    slug: 'golden-promise',
    label: 'Engagement',
    communities: [],
    keywords: [
      'engagement invitation online',
      'ring ceremony invitation',
      'scratch to reveal save the date',
    ],
    summary:
      'Golden Promise is an embossed, cream-and-gold invitation website with a monogram seal, scratch-to-reveal date, ceremony cards and venue details.',
    paragraphs: [
      'Golden Promise looks like a premium embossed card. Guests tap the monogram wax seal, a soft golden light fills the screen, and both families’ invitation appears with blessings from elders.',
      'A scratch-to-reveal save-the-date turns your date into a small surprise, followed by illustrated cards for each ceremony, the venue with directions, a memories video and RSVP contacts. It is a lovely choice for engagements, ring ceremonies and sagai.',
    ],
    highlights: [
      'Embossed card with monogram seal',
      'Scratch-to-reveal save the date',
      'Illustrated ceremony cards',
      'Venue with directions',
      'Memories video and RSVP contacts',
    ],
  },
  {
    slotId: 'tpl-royal-gate',
    slug: 'royal-gate-sikh-wedding',
    label: 'Sikh Wedding',
    communities: ['sikh', 'punjabi'],
    keywords: [
      'sikh wedding invitation',
      'anand karaj invitation card',
      'sikh wedding card online',
    ],
    summary:
      'Royal Gate is a Sikh Anand Karaj invitation website: palace gates open to a moonlit courtyard, with Ik Onkar, a shabad, events, family and WhatsApp RSVP.',
    paragraphs: [
      'Royal Gate opens with ornate palace gates tied with a silk ribbon and wax seal. Guests tap to begin, the ribbon falls and the gates swing open onto a moonlit palace courtyard with your names.',
      'Inside, the invitation begins with Ik Onkar and a shabad, introduces both families, and lets guests scratch a golden heart to reveal the date. There is a countdown, your story with photos, each event with a map, the family section and an RSVP that replies straight to you on WhatsApp — made for the Anand Karaj and every function around it.',
    ],
    highlights: [
      'Palace gates that open on tap',
      'Ik Onkar and shabad',
      'Scratch-the-heart date reveal',
      'Countdown, story and events with maps',
      'RSVP by WhatsApp',
    ],
  },
  {
    slotId: 'tpl-chateau-classic',
    slug: 'chateau-classic-wedding',
    label: 'Classic Wedding',
    communities: ['christian'],
    keywords: [
      'church wedding invitation online',
      'destination wedding invitation website',
      'christian wedding invitation',
    ],
    summary:
      'Château is a classic watercolour wedding invitation website with schedule, map, dress code and gift registry — for church and destination weddings.',
    paragraphs: [
      'Château opens on a deep wine-red card with your names and a “Tap to open” seal, then gives way to a watercolour illustration of the couple and a warm note to friends and family.',
      'Everything guests ask about is answered on one page: a schedule of events, the location with a sketch of the venue and a Google Maps link, a dress code with a colour palette, gift registry notes, a contact for help and your chosen background music. It is ideal for church weddings, Christian weddings and destination celebrations.',
    ],
    highlights: [
      'Tap-to-open seal',
      'Watercolour couple illustration',
      'Schedule of events',
      'Location, dress code palette and gift registry',
      'Background music',
    ],
  },
  {
    slotId: 'tpl-temple-bells',
    slug: 'temple-bells-traditional-wedding',
    label: 'South Indian Wedding',
    communities: ['south-indian', 'hindu'],
    keywords: [
      'south indian wedding invitation',
      'tamil wedding invitation online',
      'temple wedding invitation',
    ],
    summary:
      'Temple Bells is a South Indian temple wedding invitation website: banana trees and a gopuram intro, couple profiles, how-we-met, countdown and events.',
    paragraphs: [
      'Temple Bells opens beside a lotus pond framed by banana trees, with your monogram glowing in a gold circle. Tap it and the view rises past a temple gopuram into a festive courtyard of marigolds and bells.',
      'Guests then meet the couple — with parents’ names under each photo — read a “How We Met” timeline, watch the countdown to the muhurtham and see every event with its venue and map. It is designed for Tamil, Telugu, Kannada and Malayali temple weddings.',
    ],
    highlights: [
      'Temple gopuram & lotus pond intro',
      'Meet the couple with parents’ names',
      'How We Met timeline',
      'Countdown to the muhurtham',
      'Events with venue maps',
    ],
  },
];

export function templateSeoBySlug(slug: string): TemplateSeo | undefined {
  return TEMPLATE_SEO.find((entry) => entry.slug === slug);
}

export function templateSeoBySlotId(slotId: string): TemplateSeo | undefined {
  return TEMPLATE_SEO.find((entry) => entry.slotId === slotId);
}
