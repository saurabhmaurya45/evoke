/** Page-level SEO metadata consumed by the SeoService. */
export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  /** Absolute URL of the page. Defaults to the app URL plus the current route path. */
  readonly url?: string;
  readonly image?: string;
  /** Describes `image` for og:image:alt / twitter:image:alt. */
  readonly imageAlt?: string;
  readonly type?: 'website' | 'article' | 'product';
  readonly keywords?: readonly string[];
  readonly canonical?: string;
  readonly robots?: string;
}
