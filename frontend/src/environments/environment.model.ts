/**
 * Strongly-typed environment contract. Every environment file must
 * satisfy this shape, so a missing key is a compile-time error.
 */
export interface AppEnvironment {
  readonly production: boolean;
  readonly name: 'development' | 'staging' | 'production';
  readonly apiBaseUrl: string;
  readonly appUrl: string;
  /** Supabase project URL and publishable (anon) key — safe to expose client-side. */
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly features: {
    readonly analytics: boolean;
    readonly themeToggle: boolean;
  };
}
