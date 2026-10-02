import { CONTACT_EMAIL, CONTACT_INSTAGRAM, CONTACT_WHATSAPP } from './app.constants';
import type { FooterColumn, NavLink, SocialLink } from '../models';

/** Primary in-page navigation (home sections). */
export const PRIMARY_NAV: readonly NavLink[] = [
  { label: 'Home', fragment: 'hero' },
  { label: 'Services', fragment: 'services' },
  { label: 'Templates', path: '/templates' },
  { label: 'How It Works', fragment: 'how-it-works' },
  { label: 'FAQ', fragment: 'faq' },
  { label: 'Contact', fragment: 'footer-contact' },
];

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Services', fragment: 'services' },
      { label: 'Templates', path: '/templates' },
      { label: 'How It Works', fragment: 'how-it-works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', fragment: 'hero' },
      { label: 'FAQ', fragment: 'faq' },
      { label: 'Contact', fragment: 'footer-contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms & Conditions', path: '/terms' },
    ],
  },
];

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: 'Gmail', href: `mailto:${CONTACT_EMAIL}`, icon: 'gmail' },
  { label: 'WhatsApp', href: CONTACT_WHATSAPP, icon: 'whatsapp', external: true },
  { label: 'Instagram', href: CONTACT_INSTAGRAM, icon: 'instagram', external: true },
];
