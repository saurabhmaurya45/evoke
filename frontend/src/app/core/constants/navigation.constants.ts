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
      { label: 'Wedding Invitations', path: '/wedding-invitations' },
      { label: 'Engagement Invitations', path: '/engagement-invitations' },
      { label: 'Templates', path: '/templates' },
      { label: 'How It Works', fragment: 'how-it-works' },
    ],
  },
  {
    // Crawlable links to every community landing page.
    title: 'By Tradition',
    links: [
      { label: 'Punjabi Wedding', path: '/wedding-invitations/punjabi' },
      { label: 'Sikh Wedding', path: '/wedding-invitations/sikh' },
      { label: 'Nikah Invitation', path: '/wedding-invitations/muslim-nikah' },
      { label: 'Hindu Wedding', path: '/wedding-invitations/hindu' },
      { label: 'South Indian Wedding', path: '/wedding-invitations/south-indian' },
      { label: 'Christian Wedding', path: '/wedding-invitations/christian' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Blog', path: '/blog' },
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
