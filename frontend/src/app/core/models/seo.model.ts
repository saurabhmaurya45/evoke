/** Page-level SEO metadata consumed by the SeoService. */
export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly url?: string;
  readonly image?: string;
  readonly type?: 'website' | 'article' | 'product';
  readonly keywords?: readonly string[];
  readonly canonical?: string;
  readonly robots?: string;
}
