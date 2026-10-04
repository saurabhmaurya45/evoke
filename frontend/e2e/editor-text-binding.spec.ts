import { expect, test, type Frame, type Locator, type Page } from '@playwright/test';

/**
 * Editing a text field must update exactly the places that show it — every
 * keystroke, after clearing, and when typing again — and never touch any other
 * text. Regression for find-and-replace bridges that turned "November" into
 * "NoTanuember" and ignored cleared fields.
 */
const TEMPLATES = [
  'tpl-samarpan-royal',
  'tpl-eternal-bond',
  'tpl-beloved-nikkah',
  'tpl-rosewood-punjabi',
  'tpl-maroon-gold-royal',
  'tpl-doorway-modern',
  'tpl-golden-promise',
  'tpl-royal-gate',
  'tpl-chateau-classic',
  'tpl-temple-bells',
];

const FIELDS = [
  // Made-up names that can't occur in any template's own copy.
  { label: /^groom['’]?s? (full )?name$|^groom$/i, first: 'Qorvin', second: 'Zelmar' },
  { label: /^bride['’]?s? (full )?name$|^bride$/i, first: 'Wynthe', second: 'Xaviel' },
];

async function previewFrame(page: Page): Promise<Frame> {
  const handle = await page.locator('iframe.preview__frame').elementHandle();
  const frame = await handle!.contentFrame();
  return frame!;
}

/**
 * All rendered text of the preview — including sections hidden behind an
 * envelope or intro screen — but not script/style contents. Case-folded.
 */
async function previewText(frame: Frame): Promise<string> {
  const text = await frame.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const tag = node.parentElement?.tagName;
      if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'NOSCRIPT' && tag !== 'TEMPLATE') {
        out.push(node.nodeValue ?? '');
      }
    }
    return out.join(' ');
  });
  return text.toLowerCase();
}

const count = (text: string, word: string) => text.split(word.toLowerCase()).length - 1;

/**
 * Text with the given names (and initials shown with them) masked, digits dropped (countdowns tick) and runs
 * of a repeated phrase collapsed to one (animations append "scroll up" etc.).
 */
function normalise(text: string, names: string[]): string {
  let out = text;
  for (const name of names.filter(Boolean)) out = out.split(name.toLowerCase()).join('§');
  const words = out.replace(/[0-9०-९]/g, '').split(/\s+/).filter(Boolean);
  // An initial shown right before a name (a monogram, a quiz avatar) follows it.
  for (let i = 0; i + 1 < words.length; i++) {
    if (words[i + 1] === '§' && /^\p{L}$/u.test(words[i])) words[i] = '§i';
  }
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + 2 * n <= words.length; ) {
      const same = words.slice(i, i + n).join(' ') === words.slice(i + n, i + 2 * n).join(' ');
      if (same && !words.slice(i, i + n).includes('§')) words.splice(i + n, n);
      else i++;
    }
  }
  return words.join(' ');
}

/**
 * Wait until the preview's text has been unchanged for 2s (max 20s) — loading
 * screens and late-rendered sections must be gone before the baseline is taken.
 */
async function settledText(frame: Frame): Promise<string> {
  let previous = '';
  let stableFor = 0;
  for (let waited = 0; waited < 20_000 && stableFor < 2_000; waited += 500) {
    const text = normalise(await previewText(frame), []);
    stableFor = text === previous ? stableFor + 500 : 0;
    previous = text;
    await frame.page().waitForTimeout(500);
  }
  return previewText(frame);
}

/** The first region where two normalised texts differ, for a readable failure. */
function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const ctx = (s: string) => s.slice(Math.max(0, i - 30), s.length - j + 30);
  return `expected …${ctx(a)}… got …${ctx(b)}…`;
}

async function waitForPreview(frame: Frame, expected: (text: string) => boolean): Promise<string> {
  let text = '';
  await expect
    .poll(async () => expected((text = await previewText(frame))), { timeout: 5_000 })
    .toBe(true)
    .catch(() => undefined);
  return text;
}

for (const id of TEMPLATES) {
  test(`editor text binding: ${id}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/editor/${id}`);
    await expect(page.locator('iframe.preview__frame')).toBeVisible({ timeout: 20_000 });
    const frame = await previewFrame(page);
    // Let the template render and the first data push land.
    await page.waitForTimeout(3_000);

    const problems: string[] = [];
    for (const field of FIELDS) {
      const input: Locator = page.getByRole('textbox', { name: field.label }).first();
      if (!(await input.count())) {
        problems.push(`no field matching ${field.label}`);
        continue;
      }
      const original = await input.inputValue();
      // A real edit and back first: some templates mount sections on the first
      // data change (an unchanged value isn't sent), and they belong in the baseline.
      await input.fill(original + 'z');
      await page.waitForTimeout(300);
      await input.fill(original);
      const baseline = await settledText(frame);
      const shown = original ? count(baseline, original) : 0;
      if (original && !shown) {
        problems.push(`${field.label}: initial "${original}" not shown in preview`);
        continue;
      }

      // 1. Type a new name one key at a time.
      await input.fill('');
      await input.pressSequentially(field.first, { delay: 60 });
      let text = await waitForPreview(frame, (t) => count(t, field.first) === shown);
      if (count(text, field.first) !== shown) {
        problems.push(`${field.label}: typed "${field.first}" shows ${count(text, field.first)}x, expected ${shown}x`);
      }
      if (normalise(text, [field.first]) !== normalise(baseline, [original])) {
        problems.push(
          `${field.label}: typing "${field.first}" changed other text: ` +
            firstDiff(normalise(baseline, [original]), normalise(text, [field.first])),
        );
      }

      // 2. Clear it.
      await input.fill('');
      text = await waitForPreview(frame, (t) => count(t, field.first) === 0);
      if (count(text, field.first) !== 0) {
        problems.push(`${field.label}: still shows "${field.first}" after clearing`);
      }

      // 3. Type another name.
      await input.pressSequentially(field.second, { delay: 60 });
      text = await waitForPreview(
        frame,
        (t) => count(t, field.second) === shown && count(t, field.first) === 0,
      );
      if (count(text, field.second) !== shown || count(text, field.first) !== 0) {
        problems.push(
          `${field.label}: after retyping shows "${field.second}" ${count(text, field.second)}x ` +
            `(expected ${shown}) and "${field.first}" ${count(text, field.first)}x`,
        );
      }
      if (normalise(text, [field.second]) !== normalise(baseline, [original])) {
        problems.push(
          `${field.label}: retyping "${field.second}" changed other text: ` +
            firstDiff(normalise(baseline, [original]), normalise(text, [field.second])),
        );
      }

      // Leave the field as it was for the next check.
      await input.fill(original);
      await page.waitForTimeout(500);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
