/** Shared, presentation-level types reused across feature UIs. */

export type Nullable<T> = T | null;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ImageCredit {
  readonly credit: string;
  readonly creditHref: string;
}
