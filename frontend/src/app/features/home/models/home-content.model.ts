import type { ImageCredit } from '../../../shared/types/ui.types';

export interface StatItem {
  readonly label: string;
  /** Numeric target for the count-up, or null for static text (e.g. "Instant"). */
  readonly target: number | null;
  readonly staticValue?: string;
  readonly suffix?: string;
}

export interface ServiceCard {
  readonly title: string;
  readonly description: string;
  readonly iconGradient: string;
  readonly cardWash: string;
  /** SVG path/markup key resolved in the template. */
  readonly icon: 'heart' | 'rings';
}

export interface HowItWorksStep {
  readonly number: string;
  readonly title: string;
  readonly desc: string;
}

export interface TemplateCard extends ImageCredit {
  readonly name: string;
  readonly category: 'Wedding' | 'Engagement';
  readonly slotId: string;
  readonly wash: string;
  readonly accent: string;
  readonly monogram: string;
  readonly photo: string;
  /** URL of the full, rendered invitation template shown in the preview. */
  readonly previewUrl: string;
}

export interface FeatureItem {
  readonly title: string;
  readonly desc: string;
  readonly icon: string;
  readonly accent: string;
}

export interface Testimonial {
  readonly name: string;
  readonly role: string;
  readonly quote: string;
  readonly initials: string;
}

export interface PricingTier {
  readonly name: string;
  readonly price: string;
  readonly featured: boolean;
  readonly perks: readonly string[];
  readonly surface: 'glass' | 'featured' | 'luxury';
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}
