import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { APP_NAME } from '../constants/app.constants';
import type { SeoMetadata } from '../models/seo.model';

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

  apply(data: SeoMetadata): void {
    const fullTitle = data.title.includes(APP_NAME) ? data.title : `${data.title} • ${APP_NAME}`;
    const url = data.url ?? environment.appUrl;
    const image = data.image ?? `${environment.appUrl}/assets/images/image-1.jpg`;

    this.title.setTitle(fullTitle);
    this.setTag('name', 'description', data.description);
    this.setTag('name', 'robots', data.robots ?? 'index, follow');
    if (data.keywords?.length) {
      this.setTag('name', 'keywords', data.keywords.join(', '));
    }

    // OpenGraph
    this.setTag('property', 'og:title', fullTitle);
    this.setTag('property', 'og:description', data.description);
    this.setTag('property', 'og:type', data.type ?? 'website');
    this.setTag('property', 'og:url', url);
    this.setTag('property', 'og:image', image);
    this.setTag('property', 'og:site_name', APP_NAME);

    // Twitter
    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', fullTitle);
    this.setTag('name', 'twitter:description', data.description);
    this.setTag('name', 'twitter:image', image);

    this.setCanonical(data.canonical ?? url);
  }

  /**
   * Injects JSON-LD structured data for rich results. Pass an array to emit a
   * `@graph`, which is how multiple entities (Organization + WebSite + FAQ)
   * should be declared on one page.
   */
  setStructuredData(schema: Record<string, unknown> | readonly Record<string, unknown>[]): void {
    const id = 'evoke-structured-data';
    this.document.getElementById(id)?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
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
