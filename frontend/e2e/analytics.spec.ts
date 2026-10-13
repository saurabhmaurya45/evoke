import { expect, test, type Page } from '@playwright/test';

/**
 * Ads measurement (AnalyticsService): GA4 is configured in production, the
 * Meta Pixel isn't yet. Nothing may load before the visitor accepts the consent
 * banner, and couples' invitation pages are never tracked.
 *
 * Every request to Google/Meta is aborted here, so tests never send hits into
 * the real analytics property — we only assert that they were attempted.
 */
const TRACKERS = /googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|facebook\.com\/tr/;

function blockTrackers(page: Page): string[] {
  const seen: string[] = [];
  void page.route(TRACKERS, (route) => {
    seen.push(route.request().url());
    return route.abort();
  });
  return seen;
}

const banner = (page: Page) => page.locator('app-consent-banner .consent');

test('no tracker loads before consent; accepting loads GA4 only', async ({ page }) => {
  const seen = blockTrackers(page);
  await page.goto('/templates');
  await expect(banner(page)).toBeVisible();
  await page.waitForTimeout(1000);
  expect(seen).toEqual([]);

  await banner(page).getByRole('button', { name: 'Accept' }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(() => seen.some((u) => u.includes('gtag/js?id=G-132528WVE1'))).toBe(true);
  // The Meta Pixel has no ID yet.
  expect(seen.some((u) => u.includes('facebook'))).toBe(false);

  // The choice is remembered: no banner on the next page.
  await page.goto('/wedding-invitations');
  await expect(banner(page)).toHaveCount(0);
});

test('declining loads nothing and is remembered', async ({ page }) => {
  const seen = blockTrackers(page);
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Decline' }).click();
  await page.goto('/templates');
  await page.waitForTimeout(1000);
  await expect(banner(page)).toHaveCount(0);
  expect(seen).toEqual([]);
});

test('invitation pages never show the banner or load trackers', async ({ page }) => {
  const seen = blockTrackers(page);
  await page.goto('/i/some-couple-k7x2');
  await page.waitForTimeout(1500);
  await expect(banner(page)).toHaveCount(0);
  expect(seen).toEqual([]);
});

test('prerendered HTML carries no tracking code', async ({ request }) => {
  for (const path of ['/', '/templates', '/privacy']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(TRACKERS);
    expect(html, path).not.toMatch(/gtag\(|fbq\(/);
  }
});

test('privacy policy explains analytics and advertising cookies', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Analytics and advertising cookies' })).toBeVisible();
});
