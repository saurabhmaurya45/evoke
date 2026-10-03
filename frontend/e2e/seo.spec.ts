import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * SEO regression suite. Runs against the production build: every URL in the
 * generated sitemap must be indexable, self-canonical, titled and described
 * within limits, carry valid JSON-LD, and render without console errors.
 */
const SITE = 'https://theinvitely.in';
const sitemap = readFileSync('dist/wedding-website/browser/sitemap.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(SITE, '') || '/',
);

const TEMPLATE_COUNT = 10;

test('sitemap lists every template, hub, community page and post', () => {
  expect(paths.filter((p) => p.startsWith('/templates/'))).toHaveLength(TEMPLATE_COUNT);
  expect(paths).toContain('/wedding-invitations');
  expect(paths).toContain('/engagement-invitations');
  expect(paths.filter((p) => p.startsWith('/wedding-invitations/'))).toHaveLength(6);
  expect(paths.filter((p) => p.startsWith('/blog/'))).toHaveLength(8);
  for (const blocked of ['/login', '/signup', '/pricing', '/about', '/contact', '/services']) {
    expect(paths).not.toContain(blocked);
  }
});

for (const path of paths) {
  test(`indexable page ${path}`, async ({ page, request }) => {
    // Static HTML first: this is what crawlers and link previews see without JS.
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const html = await res.text();

    const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';

    // The full <title> as Google shows it, brand suffix included.
    expect(title.replace(/&amp;/g, '&').length).toBeLessThanOrEqual(60);
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(canonical).toBe(path === '/' ? SITE : `${SITE}${path}`);
    expect(robots).not.toContain('noindex');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:locale" content="en_IN"');
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);

    const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
    expect(ld.length).toBeGreaterThan(0);
    for (const [, json] of ld) expect(() => JSON.parse(json)).not.toThrow();

    // Then the live page: no runtime errors after hydration.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      // Backend/API calls are expected to fail offline; only app errors count.
      if (
        msg.type() === 'error' &&
        !/Failed to load resource|net::|fetch|HttpErrorResponse|Http failure|supabase/i.test(
          msg.text(),
        )
      ) {
        errors.push(msg.text());
      }
    });
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('no template is dropped: wedding hub and gallery show all templates', async ({ page }) => {
  await page.goto('/wedding-invitations');
  await expect(page.locator('app-template-strip a')).toHaveCount(TEMPLATE_COUNT);

  await page.goto('/templates');
  const links = page.locator('.card__name a');
  await expect(links).toHaveCount(TEMPLATE_COUNT);
  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  for (const href of hrefs) expect(href).toMatch(/^\/templates\/[a-z0-9-]+$/);
});

test('community pages show their own designs and link to the full catalogue', async ({ page }) => {
  // Not the whole grid: repeating all templates on every community page makes
  // them near-duplicates of the hub. The full set is one link away.
  for (const [path, featured] of [
    ['/wedding-invitations/punjabi', ['Rosewood', 'Royal Gate']],
    ['/wedding-invitations/sikh', ['Royal Gate', 'Rosewood']],
    ['/wedding-invitations/muslim-nikah', ['Beloved', 'Château']],
    ['/wedding-invitations/south-indian', ['Temple Bells', 'Maroon & Gold']],
    ['/wedding-invitations/christian', ['Château', 'Doorway']],
  ] as const) {
    await page.goto(path);
    const cards = page.locator('app-template-strip a');
    await expect(cards).toHaveCount(featured.length);
    for (const [i, name] of featured.entries()) await expect(cards.nth(i)).toContainText(name);
    await expect(
      page.getByRole('link', { name: `See all ${TEMPLATE_COUNT} invitation templates` }),
    ).toHaveAttribute('href', '/templates');
    // The shared hub copy stays on the hub only.
    await expect(
      page.getByRole('heading', { name: 'Why an invitation website beats a PDF card' }),
    ).toHaveCount(0);
  }
});

test('prerendered HTML never shows the ₹0 seed price', async ({ request }) => {
  // Prerender has no backend prices; every template would read "Free".
  for (const path of ['/templates', '/templates/royal-gate-sikh-wedding']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/class="(card__price|detail__price)[^"]*"/);
    expect(html, path).not.toMatch(/>\s*Free\s*</);
  }
});

test('homepage stats match the real catalogue', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const values = [...html.matchAll(/class="stats__value"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  expect(values).toContain(String(TEMPLATE_COUNT));
  for (const claim of ['200+', '1000+', '99%']) expect(values).not.toContain(claim);
  expect(html).not.toContain('thousands of couples');
  expect(html).not.toContain('SearchAction');
});

test('sitemap lastmod only comes from real content dates', () => {
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  for (const entry of entries) {
    if (entry.includes('/blog/')) expect(entry).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    else expect(entry).not.toContain('<lastmod>');
  }
});

test('template page links to the live preview and other templates', async ({ page }) => {
  await page.goto('/templates/royal-gate-sikh-wedding');
  await expect(page.locator('h1')).toHaveText('Royal Gate — Sikh Wedding');
  await expect(page.getByRole('link', { name: 'Live preview' })).toHaveAttribute(
    'href',
    '/preview/tpl-royal-gate',
  );
  // All other templates, none dropped.
  await expect(page.locator('app-template-strip a')).toHaveCount(TEMPLATE_COUNT - 1);
});

test('unknown slugs render the not-found page with noindex', async ({ page }) => {
  await page.goto('/templates/does-not-exist');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('private invitation pages are noindex', async ({ page, request }) => {
  // Header: seen by crawlers that never run JavaScript.
  const res = await request.get('/i/some-couple');
  expect(res.headers()['x-robots-tag']).toContain('noindex');
  // Meta tag: set by the app once it boots.
  await page.goto('/i/some-couple');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('template preview is noindex and canonicalises to the template page', async ({ page }) => {
  await page.goto('/preview/tpl-royal-gate');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE}/templates/royal-gate-sikh-wedding`,
  );
});

test('/services redirects to the wedding invitations hub', async ({ page, request }) => {
  const res = await request.get('/services', { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  await page.goto('/services');
  await expect(page).toHaveURL(/\/wedding-invitations$/);
});

test('home FAQ and features are in the server HTML (not deferred)', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('Can I send my wedding invitation on WhatsApp?');
  expect(html).toContain('Create Beautiful Wedding Invitation Websites');
  expect(html).toContain('"@type":"FAQPage"');
});

test('share card, icons, manifest and robots are served', async ({ request }) => {
  for (const asset of [
    '/og/og-default.jpg',
    '/favicon.ico',
    '/favicon.svg',
    '/icons/apple-touch-icon.png',
    '/site.webmanifest',
  ]) {
    expect((await request.get(asset)).status(), asset).toBe(200);
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://theinvitely.in/sitemap.xml');
  expect(robots).not.toContain('evoke.app');
  expect(robots).not.toMatch(/Disallow: \/i\//);
});

test('client-rendered routes still get the static share-card fallback', async ({ request }) => {
  // What WhatsApp sees for a couple's invitation link.
  const html = await (await request.get('/index.csr.html')).text();
  expect(html).toContain('og:image" content="https://theinvitely.in/og/og-default.jpg"');
});

test('JSON-LD is replaced, not carried over, on in-app navigation', async ({ page }) => {
  await page.goto('/templates/royal-gate-sikh-wedding');
  await page.getByRole('link', { name: 'See all wedding invitation designs' }).click();
  await expect(page).toHaveURL(/\/wedding-invitations$/);
  await expect(page.locator('h1')).toHaveText('Online Wedding Invitations');
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join('');
  expect(ld).toContain('/wedding-invitations#webpage');
  expect(ld).not.toContain('royal-gate-sikh-wedding#webpage');
});

test('analytics stays off until a GA4 Measurement ID is configured', async ({ page }) => {
  const gaRequests: string[] = [];
  page.on('request', (req) => {
    if (/googletagmanager\.com|google-analytics\.com/.test(req.url())) gaRequests.push(req.url());
  });
  await page.goto('/');
  await page.goto('/templates');
  expect(gaRequests).toEqual([]);
});
