import { expect, test } from '@playwright/test';

/**
 * The nav used to pick desktop vs mobile layout in JS from the window width.
 * Prerendered HTML is built with no window (assumed desktop), so phones showed
 * the crammed desktop bar until the app booted. CSS now picks the layout, so
 * it must be right even with JavaScript disabled — i.e. on the first paint.
 */
const cases = [
  { width: 360, compact: true },
  { width: 768, compact: true },
  { width: 1179, compact: true },
  { width: 1180, compact: false },
  { width: 1440, compact: false },
];

for (const javaScriptEnabled of [false, true]) {
  for (const { width, compact } of cases) {
    test(`nav at ${width}px ${javaScriptEnabled ? 'after boot' : 'before JS (first paint)'}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        javaScriptEnabled,
      });
      const page = await context.newPage();
      await page.goto('/');

      const links = page.locator('.nav__links');
      const menuButton = page.getByRole('button', { name: 'Toggle navigation menu' });
      if (compact) {
        await expect(links).toBeHidden();
        await expect(menuButton).toBeVisible();
      } else {
        await expect(links).toBeVisible();
        await expect(menuButton).toBeHidden();
      }
      const logoHeight = await page
        .locator('.nav__brand img')
        .evaluate((img) => img.getBoundingClientRect().height);
      expect(logoHeight).toBe(compact ? 34 : 42);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
      await context.close();
    });
  }
}

test('mobile menu opens and closes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Toggle navigation menu' });
  await button.click();
  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Templates' })).toBeVisible();
  await button.click();
  await expect(menu).toBeHidden();
  await context.close();
});
