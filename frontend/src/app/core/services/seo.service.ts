import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { APP_NAME } from '../constants/app.constants';
import { DEFAULT_OG_IMAGE } from '../constants/og-image.constants';
import type { SeoMetadata } from '../models/seo.model';

const STRUCTURED_DATA_ID = 'evoke-structured-data';

/** Longest <title> before Google typically truncates it in results. */
const MAX_TITLE_LENGTH = 60;

/** Lets Google show large image previews and full-length snippets. */
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1';

/**
 * Centralises document metadata: title, description, OpenGraph, Twitter
 * cards, canonical URL and robots. SSR-ready — all writes go through the
 * Meta/Title services and DOCUMENT, never `window`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  apply(data: SeoMetadata): void {
    // Brand suffix only when it fits: Google truncates titles past ~60 chars,
    // and the keyword-led part matters more than the brand.
    const branded = `${data.title} • ${APP_NAME}`;
    const fullTitle =
      data.title.includes(APP_NAME) || branded.length > MAX_TITLE_LENGTH ? data.title : branded;
    const url = data.url ?? this.currentUrl();
    const image = data.image ?? DEFAULT_OG_IMAGE.url;
    const imageAlt = data.imageAlt ?? (data.image ? fullTitle : DEFAULT_OG_IMAGE.alt);

    this.title.setTitle(fullTitle);
    this.setTag('name', 'description', data.description);
    this.setTag('name', 'robots', data.robots ?? DEFAULT_ROBOTS);
    if (data.keywords?.length) {
      this.setTag('name', 'keywords', data.keywords.join(', '));
    } else {
      this.meta.removeTag("name='keywords'");
    }

    // OpenGraph
    this.setTag('property', 'og:title', fullTitle);
    this.setTag('property', 'og:description', data.description);
    this.setTag('property', 'og:type', data.type ?? 'website');
    this.setTag('property', 'og:url', url);
    this.setTag('property', 'og:image', image);
    this.setTag('property', 'og:image:alt', imageAlt);
    this.setTag('property', 'og:site_name', APP_NAME);
    this.setTag('property', 'og:locale', 'en_IN');
    // Dimensions are only known for the default card; stale values would be wrong.
    if (image === DEFAULT_OG_IMAGE.url) {
      this.setTag('property', 'og:image:width', String(DEFAULT_OG_IMAGE.width));
      this.setTag('property', 'og:image:height', String(DEFAULT_OG_IMAGE.height));
    } else {
      this.meta.removeTag("property='og:image:width'");
      this.meta.removeTag("property='og:image:height'");
    }

    // Twitter
    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', fullTitle);
    this.setTag('name', 'twitter:description', data.description);
    this.setTag('name', 'twitter:image', image);
    this.setTag('name', 'twitter:image:alt', imageAlt);

    this.setCanonical(data.canonical ?? url);
    // Drop the previous page's JSON-LD on client-side navigation; pages that
    // have their own call setStructuredData() right after apply().
    this.document.getElementById(STRUCTURED_DATA_ID)?.remove();
  }

  /**
   * Absolute URL for the active route, without query string or fragment, so
   * filtered or tracked variants (?q=, ?utm_…) all canonicalise to one page.
   */
  private currentUrl(): string {
    const path = this.router.url.split(/[?#]/)[0];
    return path === '/' ? environment.appUrl : `${environment.appUrl}${path}`;
  }

  /**
   * Injects JSON-LD structured data for rich results. Pass an array to emit a
   * `@graph`, which is how multiple entities (Organization + WebSite + FAQ)
   * should be declared on one page.
   */
  setStructuredData(schema: Record<string, unknown> | readonly Record<string, unknown>[]): void {
    this.document.getElementById(STRUCTURED_DATA_ID)?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = STRUCTURED_DATA_ID;
    script.text = JSON.stringify(
      Array.isArray(schema) ? { '@context': 'https://schema.org', '@graph': schema } : schema,
    );
    this.document.head.appendChild(script);
  }

  /**
   * FAQPage markup from the on-page Q&A. Google requires the answers to be
   * visible on the page, which they are — the FAQ section renders them.
   */
  faqSchema(items: readonly { question: string; answer: string }[]): Record<string, unknown> {
    return {
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    };
  }

  /** BreadcrumbList markup. Paths are app-relative ('/templates'); the last item is the current page. */
  breadcrumbSchema(items: readonly { name: string; path: string }[]): Record<string, unknown> {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.path === '/' ? environment.appUrl : `${environment.appUrl}${item.path}`,
      })),
    };
  }

  private setTag(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content }, `${attr}='${key}'`);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
