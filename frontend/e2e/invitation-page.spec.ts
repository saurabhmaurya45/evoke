import { expect, test, type Page } from '@playwright/test';

/** Couples' invitation pages (/i/:slug) as guests see them. */
async function openInvitation(page: Page, templateSlotId: string): Promise<void> {
  await page.route('**/v1/i/test-couple-k7x2', (route) =>
    route.fulfill({
      json: {
        eventId: '00000000-0000-0000-0000-000000000001',
        slug: 'test-couple-k7x2',
        title: templateSlotId,
        status: 'PUBLISHED',
        ownerId: '00000000-0000-0000-0000-000000000002',
        templateSlotId,
        draftData: {},
        schemaVersion: 1,
      },
    }),
  );
  await page.goto('/i/test-couple-k7x2');
}

const pill = (page: Page) => page.locator('.made-with');

test('the pill fades in, links to the site in a new tab, and can be closed', async ({ page }) => {
  await openInvitation(page, 'tpl-eternal-bond');
  await expect(pill(page)).toHaveClass(/made-with--in/, { timeout: 15_000 });

  const link = pill(page).getByRole('link', { name: /Made with theinvitely\.in/ });
  await expect(link).toHaveAttribute('target', '_blank');
  const href = (await link.getAttribute('href'))!;
  expect(href).toContain('utm_source=invitation');
  expect(href).toContain('utm_campaign=made_with');

  await pill(page).getByRole('button', { name: 'Hide' }).click();
  await expect(pill(page)).toHaveCount(0);
});

for (const slot of ['tpl-eternal-bond', 'tpl-maroon-gold-royal', 'tpl-royal-gate', 'tpl-temple-bells', 'tpl-doorway-modern', 'tpl-ayodhya-royal']) {
  test(`pill over ${slot}`, async ({ page }, info) => {
    await openInvitation(page, slot);
    await expect(pill(page)).toHaveClass(/made-with--in/, { timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath(`${slot}.png`) });
  });
}

test('a media file that fails to load never shows guests an error box', async ({ page }) => {
  // Eternal Bond used to draw a red "[bundle] error" box for any failed image/video.
  await page.route(/invitation-templates\/.*\.(jpe?g|png|webp|mp4)(\?|$)/, (route) => route.abort());
  await openInvitation(page, 'tpl-eternal-bond');
  await expect(pill(page)).toHaveClass(/made-with--in/, { timeout: 15_000 });
  const frame = page.frames().find((f) => f.url().includes('template%202'))!;
  await expect
    .poll(() => frame.evaluate(() => document.body?.innerText.includes('[bundle]') ?? false))
    .toBe(false);
  expect(await frame.locator('#__bundler_err').count()).toBe(0);
});
