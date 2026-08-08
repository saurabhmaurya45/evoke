/** A primary navigation entry. `fragment` scrolls within the home page. */
export interface NavLink {
  readonly label: string;
  readonly fragment?: string;
  readonly path?: string;
  readonly external?: boolean;
}

export interface FooterColumn {
  readonly title: string;
  readonly links: readonly NavLink[];
}

export interface SocialLink {
  readonly label: string;
  readonly href: string;
  /** Named icon key resolved by the icon component. */
  readonly icon: 'instagram' | 'facebook' | 'x';
}
