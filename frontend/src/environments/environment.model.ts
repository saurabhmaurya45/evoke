/**
 * Strongly-typed environment contract. Every environment file must
 * satisfy this shape, so a missing key is a compile-time error.
 */
export interface AppEnvironment {
  readonly production: boolean;
  readonly name: 'development' | 'staging' | 'production';
  readonly apiBaseUrl: string;
  readonly appUrl: string;
  /**
   * Origin + bucket prefix that template media (videos, audio, images) is served
   * from, e.g. `https://pub-xxxx.r2.dev/asset` (a Cloudflare R2 public bucket). Empty = same origin
   * (`public/`), which is what local development uses. See `mediaUrl()`.
   */
  readonly mediaBaseUrl: string;
  /** Supabase project URL and publishable (anon) key — safe to expose client-side. */
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  /** GA4 measurement ID (`G-…`); null disables Google Analytics. */
  readonly ga4MeasurementId: string | null;
  /** Meta (Facebook/Instagram) Pixel ID; null disables the pixel. */
  readonly metaPixelId: string | null;
  readonly features: {
    readonly analytics: boolean;
    readonly themeToggle: boolean;
  };
}
