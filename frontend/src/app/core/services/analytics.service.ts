import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WINDOW } from '../tokens/window.token';

type Gtag = (...args: unknown[]) => void;
type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

/**
 * Paths never reported. A couple's invitation URL (/i/<slug>) identifies them,
 * and guests opening it are not our visitors to profile.
 */
const EXCLUDED_PATHS = [/^\/i(\/|$)/];

/**
 * Google Analytics 4. Off unless `features.analytics` is on AND a Measurement
 * ID is set, and never on the server — prerendered HTML carries no tag.
 *
 * GA4's automatic page_view only fires on full page loads, so it is disabled
 * and a page_view is sent on every router NavigationEnd instead.
 *
 * Keyword rankings are NOT here — Google hides search terms from Analytics.
 * They live in Search Console; link it to this property to see them in GA4.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly window: GtagWindow | null = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly id = environment.gaMeasurementId;
  private gtag: Gtag | null = null;

  get enabled(): boolean {
    return !!(this.window && environment.features.analytics && this.id);
  }

  init(): void {
    if (!this.enabled) return;
    const win = this.window!;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      // Next tick: the routed page sets its <title> during the render that
      // follows NavigationEnd, and page_title should be the new page's.
      .subscribe((event) => win.setTimeout(() => this.pageView(event.urlAfterRedirects)));
  }

  /**
   * Loads gtag.js on the first tracked page view — not at startup — so a
   * guest who only ever opens an invitation (/i/…) never downloads it and
   * never gets Google Analytics cookies.
   */
  private load(): Gtag {
    if (this.gtag) return this.gtag;
    const win = this.window!;

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.id)}`;
    this.document.head.appendChild(script);

    win.dataLayer = win.dataLayer ?? [];
    // gtag.js reads the `arguments` object off dataLayer, not a plain array.
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      win.dataLayer!.push(arguments);
    };
    this.gtag = win.gtag;
    this.gtag('js', new Date());
    this.gtag('config', this.id, { send_page_view: false });
    return this.gtag;
  }

  /** Records a GA4 event (no-op when analytics is off or on excluded pages). */
  event(name: string, params: Record<string, unknown> = {}): void {
    if (!this.gtag || this.isExcluded(this.router.url)) return;
    this.gtag('event', name, params);
  }

  private pageView(url: string): void {
    if (this.isExcluded(url)) return;
    // Query strings can carry tokens (auth callbacks, payment ids) — send the path only.
    const path = url.split(/[?#]/)[0];
    this.load()('event', 'page_view', {
      page_path: path,
      page_location: `${environment.appUrl}${path === '/' ? '' : path}`,
      page_title: this.document.title,
    });
  }

  private isExcluded(url: string): boolean {
    const path = url.split(/[?#]/)[0];
    return EXCLUDED_PATHS.some((re) => re.test(path));
  }
}
