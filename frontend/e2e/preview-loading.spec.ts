import { expect, test } from '@playwright/test';

// Opening a template from a card must give immediate feedback: a progress bar
// while the route loads, then a loader over the template until its iframe loads.

test('template preview shows a loader until the template has loaded', async ({ page }) => {
  // Hold the template document back so the loading state is observable.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/invitation-templates/**/index.html', async (route) => {
    await held;
    await route.continue();
  });

  await page.goto('/preview/tpl-royal-gate');
  const loader = page.locator('.preview__loading');
  await expect(loader).toBeVisible();
  await expect(page.locator('iframe.preview__frame')).toBeAttached();
  // The iframe's initial about:blank load must not hide the loader.
  await page.waitForTimeout(500);
  await expect(loader).toBeVisible();

  release();
  await expect(loader).toBeHidden({ timeout: 15000 });
});

test('tapping a template card shows the navigation progress bar', async ({ page }) => {
  await page.goto('/templates');
  // Slow the preview route's code so the navigation stays pending for a moment.
  await page.route('**/chunk-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page
    .locator('.tcard__actions a', { hasText: /^Preview$/ })
    .first()
    .click();
  const bar = page.locator('.nav-progress');
  await expect(bar).toBeVisible();
  await page.waitForURL('**/preview/**');
  await expect(bar).toBeHidden();
});
