import { expect, test } from '@playwright/test';

/** Homepage templates carousel: phone cards, every template, light on video. */
for (const width of [360, 768, 1366]) {
  test(`templates section at ${width}px`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('/');
    // The section is @defer (on viewport); its placeholder carries the same
    // id, so scrolling to #templates is what makes it mount.
    const cards = page.locator('.tcard');
    await expect(async () => {
      await page.evaluate(() => document.getElementById('templates')?.scrollIntoView());
      expect(await cards.count()).toBe(10);
    }).toPass({ timeout: 20_000 });
    await page.evaluate(() => document.getElementById('templates')?.scrollIntoView());

    // Every card links to its indexable template page.
    for (const href of await page
      .locator('.tcard__phone')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))) {
      expect(href).toMatch(/^\/templates\/[a-z0-9-]+$/);
    }

    // Swipe/scroll stays inside the track — the page never scrolls sideways.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);

    // Only on-screen cards play (never all ten at once).
    await expect
      .poll(() =>
        page
          .locator('.tcard__media')
          .evaluateAll((v) => v.filter((el) => !(el as HTMLVideoElement).paused).length),
      )
      .toBeGreaterThan(0);
    const playing = await page
      .locator('.tcard__media')
      .evaluateAll((v) => v.filter((el) => !(el as HTMLVideoElement).paused).length);
    expect(playing).toBeLessThan(10);
    await page.close();
  });
}

test('templates come right after the hero stats, and "Browse Templates" reaches them', async ({
  page,
}) => {
  await page.goto('/');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('app-stats, #templates, app-services-section')].map((el) =>
      el.id ? '#' + el.id : el.tagName.toLowerCase(),
    ),
  );
  expect(order).toEqual(['app-stats', '#templates', 'app-services-section']);

  await page.getByRole('link', { name: 'Browse Templates' }).click();
  await expect(page.locator('.tcard').first()).toBeInViewport({ timeout: 15_000 });
});

test('every template card has a WhatsApp enquiry naming that template', async ({ page }) => {
  await page.goto('/templates');
  const wa = page.locator('.tcard__wa');
  await expect(wa).toHaveCount(10);
  const hrefs = await wa.evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    expect(href).toMatch(/^https:\/\/wa\.me\/917985981123\?text=/);
    expect(decodeURIComponent(href.split('text=')[1])).toMatch(/interested in the .+ template/);
  }
  // Cards are phones on /templates too, and the grid never scrolls sideways.
  await expect(page.locator('.tcard__phone')).toHaveCount(10);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
});
