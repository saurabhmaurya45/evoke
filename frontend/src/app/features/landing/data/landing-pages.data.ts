import {
  COMMUNITY_KEYWORDS,
  OCCASION_KEYWORDS,
  WEBSITE_KEYWORDS,
  WHATSAPP_KEYWORDS,
} from '../../../core/constants/seo.constants';

/**
 * Occasion hubs (/wedding-invitations, /engagement-invitations) and community
 * pages (/wedding-invitations/:community). One entry drives the route, the
 * prerender params, the page copy and the metadata, so they cannot drift.
 *
 * Hubs list every template, `featured` first. Community pages show only their
 * `featured` designs and link to the full catalogue: repeating the whole grid
 * on each would make them near-duplicates of the hub (doorway pages).
 */
export interface LandingSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LandingPage {
  /** URL path without leading slash. */
  readonly path: string;
  /** Parent hub path for breadcrumbs, or null for a hub. */
  readonly parent: string | null;
  readonly breadcrumb: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly eyebrow: string;
  readonly h1: string;
  readonly intro: string;
  /** Template slotIds shown first (hubs) or exclusively (community pages). */
  readonly featured: readonly string[];
  readonly sections: readonly LandingSection[];
  readonly faqs: readonly { question: string; answer: string }[];
}

const WEDDING_TEMPLATES = [
  'tpl-samarpan-royal',
  'tpl-eternal-bond',
  'tpl-beloved-nikkah',
  'tpl-rosewood-punjabi',
  'tpl-maroon-gold-royal',
  'tpl-doorway-modern',
  'tpl-royal-gate',
  'tpl-chateau-classic',
  'tpl-temple-bells',
];

const WHY_WEBSITE: LandingSection = {
  heading: 'Why an invitation website beats a PDF card',
  paragraphs: [
    'A PDF or JPG card is a heavy file. Guests download it, pinch to zoom, and still have to ask you for the location. An invitation website is a single link that opens instantly in any phone browser and answers every question in one scroll.',
  ],
  bullets: [
    'Opens in seconds on any phone — no download, no app',
    'Background music and your photos, not just text on a card',
    'One-tap Google Maps directions for every venue',
    'RSVP so you know who is coming',
    'Update a date or venue any time — the same link stays live',
  ],
};

const HOW_IT_WORKS: LandingSection = {
  heading: 'How it works',
  paragraphs: [
    'Pick a template, fill in your names, dates, venues and photos in the guided editor, preview it live on your phone, and publish. You get a shareable link straight away — send it on WhatsApp, Instagram, SMS or email.',
  ],
};

export const LANDING_PAGES: readonly LandingPage[] = [
  {
    path: 'wedding-invitations',
    parent: null,
    breadcrumb: 'Wedding Invitations',
    title: 'Online Wedding Invitation with RSVP & WhatsApp Sharing',
    description:
      'Create an online wedding invitation website with music, photos, maps and RSVP. Royal, Punjabi, Sikh, Nikah & South Indian designs. Share on WhatsApp.',
    keywords: [
      ...WEBSITE_KEYWORDS,
      ...WHATSAPP_KEYWORDS,
      ...OCCASION_KEYWORDS['wedding'].slice(0, 8),
    ],
    eyebrow: 'Wedding Invitations',
    h1: 'Online Wedding Invitations',
    intro:
      'Your wedding invitation, as a beautiful website. Add your names, every function from haldi to reception, venue maps, photos and music — then share one link with all your guests on WhatsApp.',
    featured: WEDDING_TEMPLATES,
    sections: [
      WHY_WEBSITE,
      {
        heading: 'Everything your guests need, on one link',
        paragraphs: [
          'Indian weddings are rarely one event. Your invitation website lists each function — haldi, mehendi, sangeet, wedding, reception — with its own date, time, venue and directions, so relatives travelling from other cities have the full schedule in their pocket.',
          'Add your love story, family names, a countdown to the big day and a gallery of pre-wedding photos. Guests can RSVP from the same page, and you can change any detail later without sending a new card.',
        ],
      },
      {
        heading: 'Designs for every tradition',
        paragraphs: [
          'Choose from royal Hindu designs, a Punjabi mandap invitation, a Sikh Anand Karaj palace gate, an elegant Nikah card, a South Indian temple wedding, a classic church-wedding watercolour and an interactive modern door — each fully customisable.',
        ],
      },
      HOW_IT_WORKS,
    ],
    faqs: [
      {
        question: 'How do I send my wedding invitation on WhatsApp?',
        answer:
          'Publish your invitation and copy its link. Paste the link into a WhatsApp chat, group or broadcast list — guests tap it and the invitation opens in their browser, with music, photos and venue maps.',
      },
      {
        question: 'Can I add haldi, mehendi and sangeet to one invitation?',
        answer:
          'Yes. Each function gets its own entry with date, time, venue and a Google Maps link, so a single invitation covers the whole wedding.',
      },
      {
        question: 'Can I change the details after sending?',
        answer:
          'Yes. Edit your invitation any time and the changes appear on the same link — no need to resend anything.',
      },
      {
        question: 'Do guests need to install an app?',
        answer: 'No. The invitation is a website, so it opens in any phone or computer browser.',
      },
    ],
  },
  {
    path: 'engagement-invitations',
    parent: null,
    breadcrumb: 'Engagement Invitations',
    title: 'Engagement & Ring Ceremony Invitation Online',
    description:
      'Create an engagement or ring ceremony invitation website with a save-the-date reveal, venue map, photos and RSVP. Share it on WhatsApp in minutes.',
    keywords: [...OCCASION_KEYWORDS['engagement'], 'save the date card online'],
    eyebrow: 'Engagement Invitations',
    h1: 'Engagement Invitations',
    intro:
      'Announce your engagement, roka or ring ceremony with an invitation website — a save-the-date reveal, the venue on Google Maps, your photos and an RSVP, all on one link for WhatsApp.',
    featured: ['tpl-golden-promise', ...WEDDING_TEMPLATES],
    sections: [
      {
        heading: 'Made for sagai, roka and ring ceremonies',
        paragraphs: [
          'An engagement is often planned quickly and shared widely. An invitation website lets you send one link to family and friends today, then add or change details as plans firm up.',
          'Golden Promise, our engagement design, opens with an embossed monogram seal and a scratch-to-reveal date. Any of our wedding designs also works for an engagement — simply change the event names.',
        ],
      },
      WHY_WEBSITE,
      HOW_IT_WORKS,
    ],
    faqs: [
      {
        question: 'Can I use the same invitation for my engagement and wedding?',
        answer:
          'You can start with an engagement invitation and create a separate wedding invitation later, or list the engagement as one of the events on your wedding invitation.',
      },
      {
        question: 'Can I add a save-the-date?',
        answer:
          'Yes. Several designs include a save-the-date section, and Golden Promise reveals the date with a scratch effect.',
      },
    ],
  },
  {
    path: 'wedding-invitations/punjabi',
    parent: 'wedding-invitations',
    breadcrumb: 'Punjabi Wedding Invitation',
    title: 'Punjabi Wedding Invitation Website | WhatsApp Digital Card',
    description:
      'Create a Punjabi wedding invitation website with every function — haldi, mehendi, cocktail, pheras — plus family blessings, venue maps and music.',
    keywords: [...COMMUNITY_KEYWORDS['punjabi'], ...WHATSAPP_KEYWORDS.slice(0, 2)],
    eyebrow: 'Punjabi Wedding',
    h1: 'Punjabi Wedding Invitation',
    intro:
      'A Punjabi shaadi is a week of celebrations, and your invitation should keep up. Put every function, every venue and your family’s blessings on one colourful invitation website that guests open straight from WhatsApp.',
    featured: ['tpl-rosewood-punjabi', 'tpl-royal-gate'],
    sections: [
      {
        heading: 'Every function, one invitation',
        paragraphs: [
          'From the chunni and haldi to the mehendi, sangeet, cocktail night, pheras or Anand Karaj and the reception — each function gets its own card with date, time, venue and a directions link. Relatives flying in from Canada or the UK see the whole schedule at a glance.',
          'Rosewood opens on an illustrated floral mandap and has space for blessings from your grandparents and both sets of parents. For a Sikh ceremony, Royal Gate opens with palace gates, Ik Onkar and a shabad.',
        ],
      },
      {
        heading: 'Wording that sounds like your family',
        paragraphs: [
          'Write your invitation in English, Hinglish or Punjabi — “Sharma parivar vallon nigha sadda…” works just as well as formal English. Add a dhol-heavy track as background music to set the mood the moment guests open the link.',
        ],
      },
      {
        heading: 'Functions to put on your Punjabi wedding invitation',
        paragraphs: [
          'Most Punjabi families spread the wedding across several days. Add each one as its own event so guests know exactly where to be — and what to wear.',
        ],
        bullets: [
          'Roka or chunni ceremony',
          'Sangeet and jaggo night',
          'Mehendi',
          'Vatna / haldi',
          'Chooda ceremony on the wedding morning',
          'Anand Karaj or pheras',
          'Reception and doli',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I write my Punjabi wedding invitation in Punjabi or Hindi?',
        answer:
          'Yes. Every text field accepts any language, so you can write in English, Hinglish, Hindi or Punjabi.',
      },
      {
        question: 'Can I add the cocktail and chunni ceremony?',
        answer: 'Yes. Add as many events as you need and name each one yourself.',
      },
    ],
  },
  {
    path: 'wedding-invitations/sikh',
    parent: 'wedding-invitations',
    breadcrumb: 'Sikh Wedding Invitation',
    title: 'Sikh Wedding & Anand Karaj Invitation Online',
    description:
      'Create a Sikh wedding invitation website for your Anand Karaj — Ik Onkar, shabad, gurdwara venue map, family details, countdown and WhatsApp RSVP.',
    keywords: COMMUNITY_KEYWORDS['sikh'],
    eyebrow: 'Sikh Wedding',
    h1: 'Sikh Wedding Invitation',
    intro:
      'Invite your family and sangat to your Anand Karaj with a dignified, beautiful invitation website — opening with Ik Onkar and a shabad, with the gurdwara on Google Maps and every function listed.',
    featured: ['tpl-royal-gate', 'tpl-rosewood-punjabi'],
    sections: [
      {
        heading: 'Designed around the Anand Karaj',
        paragraphs: [
          'Royal Gate opens with palace gates tied in silk; guests tap and the gates open onto a moonlit courtyard. The invitation itself begins with Ik Onkar and a shabad of your choice, then introduces both families.',
          'List the Akhand Path, Anand Karaj at the gurdwara, milni, langar and reception — each with time and a Google Maps link — and let guests RSVP to you directly on WhatsApp.',
        ],
      },
      {
        heading: 'Ceremonies to include in a Sikh wedding invitation',
        paragraphs: [
          'A Sikh wedding usually centres on the gurdwara, with family functions before and after. List each with its own time and map so the sangat and relatives can plan their day.',
        ],
        bullets: [
          'Akhand Path or Sehaj Path at home or the gurdwara',
          'Kurmai (engagement) and chunni',
          'Milni of the two families',
          'Anand Karaj with the four laavan',
          'Langar',
          'Reception',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I add Gurmukhi text?',
        answer:
          'Yes. Text fields accept Gurmukhi, so you can include Ik Onkar, a shabad or your family’s wording in Punjabi.',
      },
      {
        question: 'Can guests RSVP on WhatsApp?',
        answer:
          'Yes. Royal Gate includes an RSVP that sends the guest’s reply straight to your WhatsApp number.',
      },
    ],
  },
  {
    path: 'wedding-invitations/muslim-nikah',
    parent: 'wedding-invitations',
    breadcrumb: 'Nikah Invitation',
    title: 'Nikah Invitation Online | Muslim Wedding Invitation Website',
    description:
      'Create a Nikah invitation website with a Quranic verse, family names, Nikah and Walima timings, venue map and photo gallery. Share it on WhatsApp.',
    keywords: COMMUNITY_KEYWORDS['muslim-nikah'],
    eyebrow: 'Nikah Invitation',
    h1: 'Nikah Invitation Online',
    intro:
      'Share your Nikah and Walima with an elegant invitation website — a verse from the Quran, both families’ names, every event with its venue and a gallery — sent as one link on WhatsApp.',
    featured: ['tpl-beloved-nikkah', 'tpl-chateau-classic'],
    sections: [
      {
        heading: 'Graceful, respectful and complete',
        paragraphs: [
          'Beloved opens with a save-the-date seal and a floral illustration, followed by space for a verse such as “And among His signs is that He created for you mates from among yourselves, that you may dwell in tranquillity with them.”',
          'Add the Nikah, Walima, Mehndi or Manjha with dates and venues, include both families as “Son of” and “Daughter of”, and show a countdown and photo gallery.',
        ],
      },
      {
        heading: 'Events to include in a Nikah invitation',
        paragraphs: [
          'Muslim weddings in India often run over a few days. Give each event its own entry with timing — for example “after Asr prayers” — and the venue on Google Maps.',
        ],
        bullets: [
          'Mangni (engagement)',
          'Manjha or haldi',
          'Mehndi',
          'Nikah',
          'Rukhsati',
          'Walima',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I write the invitation in Urdu?',
        answer: 'Yes. Text fields accept Urdu as well as English and Hindi.',
      },
      {
        question: 'Can I list the Walima separately?',
        answer: 'Yes. Add the Walima as its own event with its own date, time and venue map.',
      },
    ],
  },
  {
    path: 'wedding-invitations/hindu',
    parent: 'wedding-invitations',
    breadcrumb: 'Hindu Wedding Invitation',
    title: 'Hindu Wedding Invitation Website | Online Vivah Invitation',
    description:
      'Create a Hindu wedding invitation website opening with Shri Ganeshay Namah — haldi, mehndi, sangeet, pheras, reception, venue maps, music and RSVP.',
    keywords: COMMUNITY_KEYWORDS['hindu'],
    eyebrow: 'Hindu Wedding',
    h1: 'Hindu Wedding Invitation',
    intro:
      'Begin with Shri Ganeshay Namah and end with the reception — a Hindu wedding invitation website that carries every ritual, every venue and your family’s blessings, ready to send on WhatsApp.',
    featured: [
      'tpl-maroon-gold-royal',
      'tpl-samarpan-royal',
      'tpl-eternal-bond',
      'tpl-rosewood-punjabi',
      'tpl-temple-bells',
    ],
    sections: [
      {
        heading: 'Traditional at heart, modern to share',
        paragraphs: [
          'Maroon & Gold opens with the Ganesh invocation and plays your chosen music; Samarpan sets your names on a royal maroon-and-gold stage; Eternal Bond opens like a real envelope. All of them list each ceremony — haldi, mehndi, sangeet, ring ceremony, mangal phera, reception — with its own venue and map.',
          'Add the names of both families and elders, a countdown to the muhurat and a gallery of your photos.',
        ],
      },
      {
        heading: 'Ceremonies to list on a Hindu wedding invitation',
        paragraphs: [
          'Rituals vary by region and family, so name each one the way your family does. Each gets its own date, time and venue.',
        ],
        bullets: [
          'Sagai or tilak',
          'Haldi',
          'Mehndi',
          'Sangeet',
          'Baraat and jaimala',
          'Pheras (saat phere) at the muhurat',
          'Vidaai and reception',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I add Shri Ganeshay Namah or another invocation?',
        answer:
          'Yes. Maroon & Gold includes the invocation, and you can edit it to any shloka or blessing.',
      },
      {
        question: 'Can I write the invitation in Hindi?',
        answer: 'Yes. Every text field accepts Hindi (Devanagari) as well as English.',
      },
    ],
  },
  {
    path: 'wedding-invitations/south-indian',
    parent: 'wedding-invitations',
    breadcrumb: 'South Indian Wedding Invitation',
    title: 'South Indian Wedding Invitation Online | Temple Wedding',
    description:
      'Create a South Indian temple wedding invitation website — gopuram intro, couple and parents’ names, muhurtham countdown, events and venue maps.',
    keywords: COMMUNITY_KEYWORDS['south-indian'],
    eyebrow: 'South Indian Wedding',
    h1: 'South Indian Wedding Invitation',
    intro:
      'For Tamil, Telugu, Kannada and Malayali weddings — an invitation website that opens at the temple gopuram, introduces the couple with their parents’ names and counts down to the muhurtham.',
    featured: ['tpl-temple-bells', 'tpl-maroon-gold-royal'],
    sections: [
      {
        heading: 'A temple wedding, on every guest’s phone',
        paragraphs: [
          'Temple Bells opens beside a lotus pond framed by banana trees; one tap rises past the temple gopuram into a courtyard of marigolds and bells. Guests then meet the couple, with each set of parents named beneath their photo.',
          'List the nichayathartham, mehendi, muhurtham and reception with times and venue maps, add a “How We Met” timeline and a countdown, and set a nadaswaram track as background music.',
        ],
      },
      {
        heading: 'Ceremonies to include in a South Indian wedding invitation',
        paragraphs: [
          'Temple weddings are timed to the muhurtham, often early in the morning, so exact times matter. Add each ceremony with its time and the temple or hall on Google Maps.',
        ],
        bullets: [
          'Nichayathartham (engagement)',
          'Pandakkal muhurtham',
          'Nalangu',
          'Kashi yatra and maalai maatral',
          'Oonjal',
          'Muhurtham (thali / mangalsutra)',
          'Reception',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I write in Tamil, Telugu, Kannada or Malayalam?',
        answer:
          'Yes. Text fields accept all Indian scripts, so you can write in your own language.',
      },
      {
        question: 'Can I show the muhurtham time?',
        answer:
          'Yes. Add the exact muhurtham time to the wedding event, and the countdown counts down to it.',
      },
    ],
  },
  {
    path: 'wedding-invitations/christian',
    parent: 'wedding-invitations',
    breadcrumb: 'Christian Wedding Invitation',
    title: 'Christian & Church Wedding Invitation Online',
    description:
      'Create a Christian or church wedding invitation website with the service and reception schedule, location map, dress code and gift registry.',
    keywords: COMMUNITY_KEYWORDS['christian'],
    eyebrow: 'Christian Wedding',
    h1: 'Christian Wedding Invitation',
    intro:
      'A classic, elegant invitation website for your church wedding — the service and reception schedule, the church on Google Maps, dress code and gift registry, all on one link.',
    featured: ['tpl-chateau-classic', 'tpl-doorway-modern'],
    sections: [
      {
        heading: 'Everything guests ask, answered once',
        paragraphs: [
          'Château opens with a wine-red seal and a watercolour of the couple, then sets out the schedule of the day, the location with a sketch and map, a dress code with a colour palette and your gift registry notes.',
          'For something more playful, Doorway welcomes guests with a carved door they knock to open, and includes a timeline, venues, gallery and RSVP.',
        ],
      },
      {
        heading: 'What to include in a Christian wedding invitation',
        paragraphs: [
          'Guests at a church wedding need the order of the day: when the service starts, where the reception is and what to wear. Each part gets its own time and map.',
        ],
        bullets: [
          'Engagement or betrothal',
          'Roce or haldi (Goan, Mangalorean and Kerala traditions)',
          'Holy Matrimony / nuptial Mass at the church',
          'Photographs with family',
          'Reception and first dance',
          'Dress code and gift registry',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I include a Bible verse?',
        answer: 'Yes. Add any verse or message to the welcome text.',
      },
      {
        question: 'Can I add a gift registry?',
        answer:
          'Yes. Château includes a registry section where you can share gift notes or a registry link.',
      },
    ],
  },
];

export function landingPageByPath(path: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.path === path);
}
