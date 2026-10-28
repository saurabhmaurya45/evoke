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

test('mobile menu shows a cross while open and closes on an outside tap or Escape', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Toggle navigation menu' });
  const menu = page.locator('#mobile-menu');

  await expect(button).toHaveText('☰');
  await button.click();
  await expect(menu).toBeVisible();
  await expect(button).toHaveText('✕');

  // A tap on the page below the nav closes it.
  await page.mouse.click(195, 700);
  await expect(menu).toBeHidden();
  await expect(button).toHaveText('☰');

  // A tap inside the menu (not on a link) keeps it open.
  await button.click();
  const box = (await menu.boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + 2);
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await context.close();
});

test('contact page shows email, phone, WhatsApp and social links', async ({ page }) => {
  await page.goto('/contact');
  // Scoped to the page body: the footer repeats the email, phone and Instagram links.
  const contact = page.locator('.contact');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We’re here to help');
  await expect(contact.locator('a[href="mailto:theinvitely@gmail.com"]')).toBeVisible();
  await expect(contact.locator('a[href="tel:+917985981123"]')).toBeVisible();
  const whatsapp = contact.getByRole('link', { name: 'Chat with us on WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/917985981123/);
  await expect(whatsapp).toHaveAttribute('target', '_blank');
  await expect(contact.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
    'href',
    'https://www.instagram.com/theinvitely.in/',
  );
});

test('navbar "Contact" opens the contact page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.locator('.nav__desktop').getByRole('link', { name: 'Contact' }).click();
  await page.waitForURL('**/contact');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We’re here to help');
});
