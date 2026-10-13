import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ANALYTICS_CONFIG, AnalyticsService, type AnalyticsConfig } from './analytics.service';

@Component({ template: '' })
class BlankPage {}

type TrackingWindow = Window & { dataLayer?: unknown[][]; gtag?: unknown; fbq?: { queue?: unknown[][] }; _fbq?: unknown };

describe('AnalyticsService', () => {
  const w = window as TrackingWindow;
  let appended: string[];

  function setup(config: Partial<AnalyticsConfig> = {}): { service: AnalyticsService; router: Router } {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankPage }]),
        {
          provide: ANALYTICS_CONFIG,
          useValue: { enabled: true, ga4MeasurementId: 'G-TEST', metaPixelId: '123', ...config },
        },
      ],
    });
    const service = TestBed.inject(AnalyticsService);
    service.init();
    return { service, router: TestBed.inject(Router) };
  }

  /** GA4 calls as plain arrays, e.g. ['event', 'purchase', {...}]. */
  const gaCalls = () => (w.dataLayer ?? []).map((args) => Array.from(args as ArrayLike<unknown>));
  const metaCalls = () => w.fbq?.queue ?? [];
  const gaEvents = (name: string) => gaCalls().filter((c) => c[0] === 'event' && c[1] === name);
  const metaEvents = (name: string) => metaCalls().filter((c) => c[0] === 'track' && c[1] === name);

  beforeEach(() => {
    localStorage.clear();
    delete w.dataLayer;
    delete w.gtag;
    delete w.fbq;
    delete w._fbq;
    appended = [];
    // Record the tracker scripts instead of loading them from Google/Meta.
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T) => {
      appended.push((node as unknown as HTMLScriptElement).src);
      return node;
    });
  });

  afterEach(() => localStorage.clear());

  it('loads nothing and asks nothing when analytics is off for the build', () => {
    const { service } = setup({ enabled: false });
    expect(service.needsConsent()).toBeFalse();
    service.track('begin_checkout');
    expect(appended).toEqual([]);
    expect(w.gtag).toBeUndefined();
  });

  it('asks for consent and loads nothing until the visitor accepts', () => {
    const { service } = setup();
    expect(service.needsConsent()).toBeTrue();
    service.track('begin_editing');
    expect(appended).toEqual([]);
    expect(w.gtag).toBeUndefined();
  });

  it('declining keeps both trackers off and hides the banner', () => {
    const { service } = setup();
    service.setConsent('denied');
    expect(service.needsConsent()).toBeFalse();
    expect(appended).toEqual([]);
    expect(localStorage.getItem('theinvitely.analytics-consent')).toBe('denied');
  });

  it('accepting loads GA4 and the Meta Pixel and sends a page view', () => {
    const { service } = setup();
    service.setConsent('granted');

    expect(appended).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-TEST',
      'https://connect.facebook.net/en_US/fbevents.js',
    ]);
    expect(gaCalls()).toContain(['config', 'G-TEST', { send_page_view: false }]);
    expect(metaCalls()).toContain(['init', '123']);
    expect(gaEvents('page_view').length).toBe(1);
    expect(metaEvents('PageView').length).toBe(1);
  });

  it('maps funnel events to GA4 and Meta standard events', () => {
    const { service } = setup();
    service.setConsent('granted');

    service.track('begin_checkout', { value: 1499, currency: 'INR' });
    service.track('login');

    expect(gaEvents('begin_checkout')[0][2]).toEqual({ value: 1499, currency: 'INR' });
    expect(metaEvents('InitiateCheckout')[0][2]).toEqual(
      jasmine.objectContaining({ value: 1499, currency: 'INR' }),
    );
    // Login is GA4-only.
    expect(gaEvents('login').length).toBe(1);
    expect(metaCalls().some((c) => c[1] === 'login')).toBeFalse();
  });

  it('counts a published invitation once, even if the success page reloads', () => {
    const { service } = setup();
    service.setConsent('granted');

    service.trackPublished('evt-1', 0, 'INR');
    service.trackPublished('evt-1', 0, 'INR');
    service.trackPublished('evt-2', 1499, 'INR');

    expect(gaEvents('purchase').map((c) => c[2])).toEqual([
      { transaction_id: 'evt-1', value: 0, currency: 'INR' },
      { transaction_id: 'evt-2', value: 1499, currency: 'INR' },
    ]);
    expect(metaEvents('Purchase').length).toBe(2);
  });

  it('never tracks or asks on couples’ invitation pages', async () => {
    const { service, router } = setup();
    await router.navigateByUrl('/i/arjun-and-priya-k7x2');
    expect(service.needsConsent()).toBeFalse();

    service.setConsent('granted');
    service.track('begin_editing');
    expect(gaEvents('page_view').length).toBe(0);
    expect(gaEvents('begin_editing').length).toBe(0);

    await router.navigateByUrl('/templates');
    expect(gaEvents('page_view').length).toBe(1);
  });

  it('remembers an earlier acceptance on the next visit', () => {
    localStorage.setItem('theinvitely.analytics-consent', 'granted');
    const { service } = setup();
    expect(service.needsConsent()).toBeFalse();
    expect(appended.length).toBe(2);
  });

  it('tracks WhatsApp link clicks as contact leads', () => {
    const { service } = setup();
    service.setConsent('granted');
    const link = document.createElement('a');
    link.href = 'https://wa.me/917985981123?text=hi';
    link.addEventListener('click', (e) => e.preventDefault());
    document.body.append(link);
    link.click();
    link.remove();
    expect(gaEvents('contact').length).toBe(1);
    expect(metaEvents('Contact').length).toBe(1);
  });
});
