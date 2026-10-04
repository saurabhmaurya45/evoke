import { expect, test } from '@playwright/test';

/**
 * The hero template phones once used absolute positioning with fixed widths
 * and overlapped on phones. Guard every common width: no card may overlap
 * another, and the page must never scroll sideways.
 */
for (const width of [320, 360, 390, 768, 1024, 1366]) {
  test(`hero phones don't overlap at ${width}px`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('/');
    const cards = page.locator('.hero__card-inner');
    await expect(cards).toHaveCount(3);

    const boxes = await cards.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlap =
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1;
        expect(overlap, `cards ${i} and ${j} overlap`).toBe(false);
      }
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);

    for (const href of await cards.evaluateAll((els) => els.map((el) => el.getAttribute('href')))) {
      expect(href).toMatch(/^\/templates\/[a-z0-9-]+$/);
    }
    await page.close();
  });
}
