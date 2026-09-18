import { Injectable } from '@angular/core';
import type {
  FaqItem,
  FeatureItem,
  HowItWorksStep,
  PricingTier,
  ServiceCard,
  StatItem,
  TemplateCard,
  Testimonial,
} from '../models/home-content.model';

// Local Unsplash-hosted imagery reused across template cards (matches source).
const COUPLE_PHOTO =
  'https://images.unsplash.com/photo-1467715701630-de0db4a0fbf0?auto=format&fit=crop&w=600&q=80';
const RING_PHOTO =
  'https://images.unsplash.com/photo-1734640547704-98a4b882f1ba?auto=format&fit=crop&w=600&q=80';
const FLOWER_PHOTO =
  'https://images.unsplash.com/photo-1605101417781-b069480f938a?auto=format&fit=crop&w=600&q=80';

const COUPLE_CREDIT = {
  credit: 'Photo by Daniel Suarez Photography on Unsplash',
  creditHref: 'https://unsplash.com/@daniel_suarez',
};
const RING_CREDIT = {
  credit: 'Photo by Alekon pictures on Unsplash',
  creditHref: 'https://unsplash.com/@alekonpictures',
};
const FLOWER_CREDIT = {
  credit: 'Photo by Chris Haws on Unsplash',
  creditHref: 'https://unsplash.com/@therook',
};

const WASH_ROSE = 'linear-gradient(155deg, rgba(201,123,99,0.22), rgba(var(--glass-rgb),0.04))';
const WASH_GOLD = 'linear-gradient(155deg, rgba(201,162,39,0.2), rgba(var(--glass-rgb),0.04))';

// Full, rendered invitation templates served as static files from /public.
// Every card below points at its own design — placeholder cards that reused
// another template as a stand-in have been removed.
const SAMARPAN_TEMPLATE = '/invitation-templates/template%201/index.html';
const ETERNAL_BOND_TEMPLATE = '/invitation-templates/template%202/index.html';
const BELOVED_NIKKAH_TEMPLATE = '/invitation-templates/template%203/index.html';
const ROSEWOOD_TEMPLATE = '/invitation-templates/template%204/index.html';
const MAROON_GOLD_TEMPLATE = '/invitation-templates/template%205/index.html';
const DOORWAY_TEMPLATE = '/invitation-templates/template%206/index.html';
const GOLDEN_PROMISE_TEMPLATE = '/invitation-templates/template%207/index.html';

export interface HeroCard {
  readonly slotId: string;
  /** Poster shown before the clip has data, and if it fails to load. */
  readonly img: string;
  /** Muted, looping, full-page-scroll capture of the live template — same asset
   * used by the templates carousel below (see `cardPreview()`). */
  readonly video: string;
  readonly title: string;
  readonly subtitle: string;
}

const HERO_TEMPLATE_SHOTS = [
  { slotId: 'tpl-samarpan-royal', templateNo: 1 },
  { slotId: 'tpl-golden-promise', templateNo: 7 },
  { slotId: 'tpl-harpreet-ritika', templateNo: 4 },
  { slotId: 'tpl-karan-nisha', templateNo: 5 },
] as const;

/**
 * Card preview media: a muted clip scrolled through the live template end to end
 * (poster shown until it has data — see `templates-section.component.ts` and
 * `hero.component.ts`, which both autoplay it). `n` is the
 * `public/invitation-templates/template N` folder holding `card.mp4` / `card-poster.jpg`.
 */
function cardPreview(n: number): { previewVideo: string; previewPoster: string } {
  return {
    previewVideo: `/invitation-templates/template%20${n}/card.mp4`,
    previewPoster: `/invitation-templates/template%20${n}/card-poster.jpg`,
  };
}

/**
 * Single source of truth for the marketing homepage content. Isolated from
 * the presentation layer so copy/data can later come from a CMS or API
 * without touching a single component. All data is deeply readonly.
 */
@Injectable({ providedIn: 'root' })
export class HomeContentService {
  readonly stats: readonly StatItem[] = [
    { label: 'Invitations Created', target: 1000, suffix: '+' },
    { label: 'Templates', target: 200, suffix: '+' },
    { label: 'Customer Satisfaction', target: 99, suffix: '%' },
    { label: 'Website Generation', target: null, staticValue: 'Instant' },
  ];

  readonly services: readonly ServiceCard[] = [
    {
      title: 'Wedding Invitations',
      description: 'Elegant, emotional websites that tell your story — from save-the-date to RSVP.',
      icon: 'heart',
      iconGradient: 'linear-gradient(135deg,#C97B63,#C9A227)',
      cardWash: 'linear-gradient(160deg,rgba(201,123,99,0.1),rgba(var(--glass-rgb),0.03))',
    },
    {
      title: 'Engagement Invitations',
      description: 'Celebrate the beginning of forever with a beautifully designed announcement.',
      icon: 'rings',
      iconGradient: 'linear-gradient(135deg,#8B5E34,#E8C88A)',
      cardWash: 'linear-gradient(160deg,rgba(232,200,138,0.1),rgba(var(--glass-rgb),0.03))',
    },
  ];

  readonly upcomingOccasions: readonly string[] = [
    'Birthday',
    'Baby Shower',
    'Housewarming',
    'Corporate',
    'Concerts',
    '+6 more',
  ];

  readonly steps: readonly HowItWorksStep[] = [
    {
      number: '01',
      title: 'Choose Service',
      desc: 'Pick the occasion — wedding, engagement, and more to come.',
    },
    {
      number: '02',
      title: 'Select Template',
      desc: 'Browse a curated library of premium designs.',
    },
    { number: '03', title: 'Customize', desc: 'Add your photos, colors, and story in minutes.' },
    { number: '04', title: 'Preview', desc: 'See your live website instantly, on any device.' },
    { number: '05', title: 'Pay', desc: 'Secure one-time checkout, no subscriptions.' },
    { number: '06', title: 'Receive Website', desc: 'Get your shareable link, ready to send.' },
  ];

  readonly templates: readonly TemplateCard[] = [
    {
      name: 'Samarpan — Royal Union',
      category: 'Wedding',
      slotId: 'tpl-samarpan-royal',
      wash: WASH_ROSE,
      accent: '#C97B63',
      monogram: 'S',
      photo: COUPLE_PHOTO,
      previewUrl: SAMARPAN_TEMPLATE,
      ...cardPreview(1),
      ...COUPLE_CREDIT,
    },
    {
      name: 'Eternal Bond — Royal Wedding',
      category: 'Wedding',
      slotId: 'tpl-eternal-bond',
      wash: WASH_ROSE,
      accent: '#C97B63',
      monogram: 'E',
      photo: FLOWER_PHOTO,
      previewUrl: ETERNAL_BOND_TEMPLATE,
      ...cardPreview(2),
      ...FLOWER_CREDIT,
    },
    {
      name: 'Beloved — Nikkah Invitation',
      category: 'Wedding',
      slotId: 'tpl-beloved-nikkah',
      wash: WASH_ROSE,
      accent: '#C97B63',
      monogram: 'B',
      photo: COUPLE_PHOTO,
      previewUrl: BELOVED_NIKKAH_TEMPLATE,
      ...cardPreview(3),
      ...COUPLE_CREDIT,
    },
    {
      name: 'Rosewood — Punjabi Wedding',
      category: 'Wedding',
      slotId: 'tpl-harpreet-ritika',
      wash: WASH_ROSE,
      accent: '#C97B63',
      monogram: 'R',
      photo: FLOWER_PHOTO,
      previewUrl: ROSEWOOD_TEMPLATE,
      ...cardPreview(4),
      ...FLOWER_CREDIT,
    },
    {
      name: 'Maroon & Gold — Royal Hindu Wedding',
      category: 'Wedding',
      slotId: 'tpl-karan-nisha',
      wash: WASH_ROSE,
      accent: '#6e1423',
      monogram: 'K',
      photo: COUPLE_PHOTO,
      previewUrl: MAROON_GOLD_TEMPLATE,
      ...cardPreview(5),
      ...COUPLE_CREDIT,
    },
    {
      name: 'Doorway — Modern Wedding',
      category: 'Wedding',
      slotId: 'tpl-joe-serin',
      wash: WASH_ROSE,
      accent: '#8a6d1f',
      monogram: 'D',
      photo: COUPLE_PHOTO,
      previewUrl: DOORWAY_TEMPLATE,
      ...cardPreview(6),
      ...COUPLE_CREDIT,
    },
    {
      name: 'Golden Promise',
      category: 'Engagement',
      slotId: 'tpl-golden-promise',
      wash: WASH_GOLD,
      accent: '#C9A227',
      monogram: 'G',
      photo: RING_PHOTO,
      previewUrl: GOLDEN_PROMISE_TEMPLATE,
      ...cardPreview(7),
      ...RING_CREDIT,
    },
  ];

  /** Resolves a template card by its slot id (used by the preview route). */
  templateBySlotId(slotId: string): TemplateCard | undefined {
    return this.templates.find((tpl) => tpl.slotId === slotId);
  }

  readonly features: readonly FeatureItem[] = [
    {
      title: 'Instant Preview',
      desc: 'See every change reflected live, instantly.',
      icon: 'eye',
      accent: '#E8C88A',
    },
    {
      title: 'Mobile Friendly',
      desc: 'Looks flawless on every screen size.',
      icon: 'phone',
      accent: '#C97B63',
    },
    {
      title: 'Shareable Link',
      desc: 'One elegant link to share anywhere.',
      icon: 'link',
      accent: '#8B5E34',
    },
    {
      title: 'Photo Gallery',
      desc: 'Showcase your favorite memories.',
      icon: 'gallery',
      accent: '#E8C88A',
    },
    {
      title: 'Music Support',
      desc: 'Set the mood with background music.',
      icon: 'music',
      accent: '#C97B63',
    },
    {
      title: 'Countdown Timer',
      desc: 'Build anticipation to the big day.',
      icon: 'clock',
      accent: '#8B5E34',
    },
    {
      title: 'Maps Integration',
      desc: 'Help guests find the venue with ease.',
      icon: 'pin',
      accent: '#E8C88A',
    },
    { title: 'RSVP', desc: 'Collect responses effortlessly.', icon: 'chat', accent: '#C97B63' },
    {
      title: 'Guest List',
      desc: 'Manage attendees in one place.',
      icon: 'users',
      accent: '#8B5E34',
    },
    { title: 'Custom Domain', desc: 'Use your own domain name.', icon: 'globe', accent: '#E8C88A' },
    {
      title: 'Fast Hosting',
      desc: 'Lightning-fast load times, always.',
      icon: 'bolt',
      accent: '#C97B63',
    },
    {
      title: 'SEO Friendly',
      desc: 'Discoverable and shareable by design.',
      icon: 'search',
      accent: '#8B5E34',
    },
  ];

  readonly traditionalRows: readonly string[] = [
    'Weeks to design and print',
    'Costly printing & postage',
    'No live updates once sent',
    'Limited guest interaction',
    'Easy to lose or misplace',
  ];

  readonly platformRows: readonly string[] = [
    'Ready in minutes',
    'One affordable payment',
    'Update anytime, instantly',
    'RSVP, maps & galleries built in',
    'Always accessible via link',
  ];

  readonly testimonials: readonly Testimonial[] = [
    {
      name: 'Ananya & Rohit',
      role: 'Newlyweds',
      quote:
        'It felt like magic watching our story come to life online. Guests still talk about our invitation website.',
      initials: 'AR',
    },
    {
      name: 'Kavya Sharma',
      role: 'Bride-to-be',
      quote:
        'Effortless and stunning. I customized everything myself in under an hour, no design skills needed.',
      initials: 'KS',
    },
    {
      name: 'Meera & Arjun',
      role: 'Engaged Couple',
      quote:
        'The RSVP and gallery features made planning so much easier. It felt genuinely premium.',
      initials: 'MA',
    },
    {
      name: 'Priya Nair',
      role: 'Event Planner',
      quote: 'I now recommend Evoke to every couple I work with. The quality speaks for itself.',
      initials: 'PN',
    },
  ];

  readonly pricing: readonly PricingTier[] = [
    {
      name: 'Starter',
      price: '$49',
      featured: false,
      surface: 'glass',
      perks: ['1 premium template', 'Custom domain link', 'Photo gallery', 'Basic support'],
    },
    {
      name: 'Premium',
      price: '$99',
      featured: true,
      surface: 'featured',
      perks: ['All templates', 'RSVP & guest list', 'Countdown & music', 'Priority support'],
    },
    {
      name: 'Luxury',
      price: '$199',
      featured: false,
      surface: 'luxury',
      perks: [
        'Everything in Premium',
        'Custom animations',
        'Dedicated designer',
        'White-glove setup',
      ],
    },
  ];

  readonly faqs: readonly FaqItem[] = [
    {
      question: 'What types of events can I create invitations for?',
      answer:
        'Today we support weddings and engagements, with birthdays, baby showers, corporate events, and more launching soon.',
    },
    {
      question: 'Do I need any design experience?',
      answer: 'None at all. Choose a template and customize it with our simple, guided editor.',
    },
    {
      question: 'Can I update my website after publishing?',
      answer:
        'Yes — edit your details, photos, and content anytime, and changes go live instantly.',
    },
    {
      question: 'How long does it take to generate my website?',
      answer: 'Your website is generated instantly after you complete customization and checkout.',
    },
    {
      question: 'Can guests RSVP directly on the website?',
      answer: 'Yes, built-in RSVP collection is included with every template.',
    },
    {
      question: 'What happens after I pay?',
      answer:
        'You receive a shareable link to your live invitation website immediately, ready to send to guests.',
    },
  ];

  /**
   * Hero floating cards show real templates, using screenshots of their rendered
   * pages. Order maps to the card slots: large, right, phone (portrait), laptop.
   */
  readonly heroCards: readonly HeroCard[] = HERO_TEMPLATE_SHOTS.map(({ slotId, templateNo }) => {
    const template = this.templateBySlotId(slotId);
    const { previewVideo, previewPoster } = cardPreview(templateNo);
    return {
      slotId,
      img: previewPoster,
      video: previewVideo,
      title: template?.name ?? '',
      subtitle: template ? `${template.category} Invitation` : '',
    };
  });
}
