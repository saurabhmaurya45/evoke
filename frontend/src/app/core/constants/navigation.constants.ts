import type { FooterColumn, NavLink, SocialLink } from '../models';

/** Primary in-page navigation (home sections). */
export const PRIMARY_NAV: readonly NavLink[] = [
  { label: 'Home', fragment: 'hero' },
  { label: 'Services', fragment: 'services' },
  { label: 'Templates', path: '/templates' },
  { label: 'How It Works', fragment: 'how-it-works' },
  { label: 'Pricing', fragment: 'pricing' },
  { label: 'FAQ', fragment: 'faq' },
  { label: 'Contact', fragment: 'footer-contact' },
];

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Services', fragment: 'services' },
      { label: 'Templates', path: '/templates' },
      { label: 'Pricing', fragment: 'pricing' },
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
];

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: 'Instagram', href: '#footer-contact', icon: 'instagram' },
  { label: 'Facebook', href: '#footer-contact', icon: 'facebook' },
  { label: 'X', href: '#footer-contact', icon: 'x' },
];
