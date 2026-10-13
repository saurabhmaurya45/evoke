import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WINDOW } from '../tokens/window.token';

/** Which trackers to load. Production reads the environment; tests inject their own. */
export interface AnalyticsConfig {
  readonly enabled: boolean;
  readonly ga4MeasurementId: string | null;
  readonly metaPixelId: string | null;
}

export const ANALYTICS_CONFIG = new InjectionToken<AnalyticsConfig>('ANALYTICS_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    enabled: environment.features.analytics,
    ga4MeasurementId: environment.ga4MeasurementId,
    metaPixelId: environment.metaPixelId,
  }),
});

/** The funnel events we measure, as GA4 event names. */
export type AnalyticsEvent =
  | 'sign_up'
  | 'login'
  | 'begin_editing'
  | 'begin_checkout'
  | 'purchase'
  | 'contact';

export type AnalyticsParams = Record<string, string | number | undefined>;

/** GA4 event → Meta Pixel standard event (null: GA4 only). */
const META_EVENT: Record<AnalyticsEvent, string | null> = {
  sign_up: 'CompleteRegistration',
  login: null,
  begin_editing: 'Lead',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  contact: 'Contact',
};

/**
 * Couples' invitations and template previews are never tracked, and never show
 * the consent banner: guests opening an invitation aren't our visitors, and the
 * privacy policy promises their visit isn't used for advertising.
 */
const UNTRACKED_PATHS = [/^\/i\//, /^\/preview(\/|$)/];

const CONSENT_KEY = 'theinvitely.analytics-consent';
type Consent = 'granted' | 'denied';

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string };
interface TrackingWindow extends Window {
  dataLayer?: unknown[];
  gtag?: Gtag;
  fbq?: Fbq;
  _fbq?: Fbq;
}

/**
 * Google Analytics 4 + Meta Pixel for measuring paid ads: page views and the
 * funnel (sign-up → editor → checkout → published).
 *
 * Nothing loads unless analytics is enabled for this build (production only),
 * an ID is configured, the visitor has accepted the consent banner, and we're
 * in a browser — never during SSR/prerender.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ANALYTICS_CONFIG);
  private readonly window = inject(WINDOW) as TrackingWindow | null;
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly configured =
    this.config.enabled && !!(this.config.ga4MeasurementId || this.config.metaPixelId);
  private readonly consent = signal<Consent | null>(this.readConsent());
  private readonly currentPath = signal(this.window?.location.pathname ?? '/');
  private loaded = false;

  /** Show the consent banner: analytics is on, undecided, and this page is trackable. */
  readonly needsConsent = computed(
    () =>
      !!this.window &&
      this.configured &&
      this.consent() === null &&
      !UNTRACKED_PATHS.some((re) => re.test(this.currentPath())),
  );

  /** Wire up page-view tracking. Called once at startup (app.config). */
  init(): void {
    if (!this.window || !this.configured) return;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentPath.set(this.pathOf(e.urlAfterRedirects));
        this.pageView();
      });
    // Any WhatsApp link (footer, nav, template cards…) is a contact lead.
    const onClick = (event: Event): void => {
      const link = (event.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (link) this.track('contact', { method: 'whatsapp' });
    };
    this.document.addEventListener('click', onClick, { capture: true });
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('click', onClick, { capture: true }),
    );
    if (this.consent() === 'granted') this.load();
  }

  /** The visitor's answer to the consent banner. */
  setConsent(choice: Consent): void {
    this.consent.set(choice);
    try {
      this.window?.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Storage unavailable — the choice holds for this visit.
    }
    if (choice === 'granted') {
      this.load();
      this.pageView();
    }
  }

  /** Record a funnel event in GA4 and, when it has an equivalent, Meta Pixel. */
  track(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
    if (!this.active()) return;
    const w = this.window!;
    w.gtag?.('event', event, params);
    const meta = META_EVENT[event];
    if (meta) {
      const { value, currency, content_name } = params;
      w.fbq?.('track', meta, { value, currency, content_name });
    }
  }

  /**
   * Record a publish as a conversion, once per event per browser — refreshing
   * the success page must not count the same invitation twice.
   */
  trackPublished(eventId: string, value: number, currency: string): void {
    if (!this.active()) return;
    const key = `theinvitely.published.${eventId}`;
    try {
      if (this.window!.localStorage.getItem(key)) return;
      this.window!.localStorage.setItem(key, '1');
    } catch {
      // Storage unavailable — count it; a rare double beats a missed conversion.
    }
    this.track('purchase', { transaction_id: eventId, value, currency });
  }

  private active(): boolean {
    return (
      this.loaded &&
      this.consent() === 'granted' &&
      !UNTRACKED_PATHS.some((re) => re.test(this.currentPath()))
    );
  }

  private pageView(): void {
    if (!this.active()) return;
    const w = this.window!;
    w.gtag?.('event', 'page_view', {
      page_location: w.location.href,
      page_path: this.currentPath(),
      page_title: this.document.title,
    });
    w.fbq?.('track', 'PageView');
    // A template's own page is the "product" being considered.
    if (/^\/templates\/[^/]+$/.test(this.currentPath())) {
      w.fbq?.('track', 'ViewContent', { content_name: this.document.title });
    }
  }

  private load(): void {
    if (this.loaded || !this.window) return;
    this.loaded = true;
    const w = this.window;
    const { ga4MeasurementId, metaPixelId } = this.config;

    if (ga4MeasurementId) {
      w.dataLayer = w.dataLayer ?? [];
      // gtag must push the `arguments` object itself, not an array copy.
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag('js', new Date());
      // Page views are sent on each SPA navigation instead.
      w.gtag('config', ga4MeasurementId, { send_page_view: false });
      this.addScript(`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`);
    }

    if (metaPixelId) {
      // Meta's loader stub: queue calls until fbevents.js arrives.
      const fbq: Fbq = function fbq(...args: unknown[]) {
        const self = fbq as Fbq & { callMethod?: (...a: unknown[]) => void };
        if (self.callMethod) self.callMethod(...args);
        else self.queue!.push(args);
      };
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      w.fbq = w._fbq = fbq;
      fbq('init', metaPixelId);
      this.addScript('https://connect.facebook.net/en_US/fbevents.js');
    }
  }

  private addScript(src: string): void {
    const script = this.document.createElement('script');
    script.async = true;
    script.src = src;
    this.document.head.appendChild(script);
  }

  private readConsent(): Consent | null {
    try {
      const value = this.window?.localStorage.getItem(CONSENT_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  private pathOf(url: string): string {
    return url.split(/[?#]/)[0] || '/';
  }
}
