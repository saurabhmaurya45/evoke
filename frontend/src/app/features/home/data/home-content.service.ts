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
// Only the Samarpan royal-wedding template ships today; the remaining cards
// reuse it as a live demo until their own designs land.
const SAMARPAN_TEMPLATE = '/invitation-templates/samarpan-royal-wedding.html';
const ETERNAL_BOND_TEMPLATE = '/invitation-templates/eternal-bond-royal.html';

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
      ...FLOWER_CREDIT,
    },
    {
      name: 'Golden Promise',
      category: 'Engagement',
      slotId: 'tpl-golden-promise',
      wash: WASH_GOLD,
      accent: '#C9A227',
      monogram: 'G',
      photo: RING_PHOTO,
      previewUrl: SAMARPAN_TEMPLATE,
      ...RING_CREDIT,
    },
    {
      name: 'Azure Story',
      category: 'Engagement',
      slotId: 'tpl-azure-story',
      wash: WASH_GOLD,
      accent: '#C9A227',
      monogram: 'A',
      photo: RING_PHOTO,
      previewUrl: SAMARPAN_TEMPLATE,
      ...RING_CREDIT,
    },
    {
      name: 'Rose Quartz',
      category: 'Wedding',
      slotId: 'tpl-rose-quartz',
      wash: WASH_ROSE,
      accent: '#C97B63',
      monogram: 'R',
      photo: FLOWER_PHOTO,
      previewUrl: SAMARPAN_TEMPLATE,
      ...FLOWER_CREDIT,
    },
    {
      name: 'Modern Vow',
      category: 'Engagement',
      slotId: 'tpl-modern-vow',
      wash: WASH_GOLD,
      accent: '#C9A227',
      monogram: 'V',
      photo: COUPLE_PHOTO,
      previewUrl: SAMARPAN_TEMPLATE,
      ...COUPLE_CREDIT,
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

  readonly heroCards = [
    {
      id: 'hero-wedding',
      img: 'assets/images/image-1.jpg',
      title: 'Elena & James',
      subtitle: 'Wedding Invitation',
      credit: COUPLE_CREDIT,
    },
    {
      id: 'hero-engagement',
      img: 'assets/images/image-2.jpg',
      title: 'Priya & Rohan',
      subtitle: 'Engagement Invitation',
      credit: RING_CREDIT,
    },
    {
      id: 'hero-phone',
      img: 'assets/images/image-3.jpg',
      title: 'Save the Date',
      subtitle: 'Invitation Suite',
      credit: FLOWER_CREDIT,
    },
    {
      id: 'hero-laptop',
      img: 'assets/images/image-4.jpg',
      title: '',
      subtitle: '',
      credit: FLOWER_CREDIT,
    },
  ] as const;
}
