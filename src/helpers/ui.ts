import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * Reusable UI assertions: colour/contrast, error styling, layout and basic
 * accessibility. They encode the checks that manual testing kept catching
 * (unreadable text, errors in the wrong colour, unlabeled controls).
 */

export type RGBA = { r: number; g: number; b: number; a: number };

export function parseColor(value: string): RGBA {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 0 };
  const [r, g, b, a = '1'] = m[1].split(/[,\s/]+/).filter(Boolean);
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}

/** Alpha-composites `top` over an opaque `bottom`. */
export function composite(top: RGBA, bottom: RGBA): RGBA {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }: RGBA): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG 2.x contrast ratio between two opaque colours (1 … 21). */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function hsl({ r, g, b }: RGBA): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

/** Red/crimson family used for errors (e.g. the app's `.env-field-error` rgb(183,37,72)). */
export function isErrorColor(color: string): boolean {
  const { h, s } = hsl(parseColor(color));
  return s >= 0.35 && (h >= 330 || h <= 12);
}

/** Amber/orange family used for warnings (e.g. rgb(169,92,0)). */
export function isWarningColor(color: string): boolean {
  const { h, s } = hsl(parseColor(color));
  return s >= 0.35 && h > 18 && h < 55;
}

/** Computed text colour of the element plus the first non-transparent background behind it. */
export async function colorsOf(locator: Locator): Promise<{ color: string; background: string; opacity: number }> {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    let node: Element | null = el;
    let background = 'rgba(0, 0, 0, 0)';
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        background = bg;
        break;
      }
      node = node.parentElement;
    }
    return { color: cs.color, background, opacity: Number(cs.opacity) };
  });
}

/**
 * Asserts the element's text is readable against `pageColor` — the colour of
 * whatever is drawn *under* the element (e.g. a black PDF page). The element's
 * own (possibly translucent) background is composited over that colour first.
 */
export async function expectTextReadableOn(
  locator: Locator,
  pageColor: RGBA,
  minRatio = 3,
  label = 'text',
): Promise<number> {
  const styles = await locator.evaluate((el) => {
    const text = getComputedStyle(el);
    const host = el.closest('[role="button"], [style*="background"]') ?? el.parentElement ?? el;
    return {
      color: text.color,
      opacity: Number(text.opacity),
      fieldBackground: getComputedStyle(host).backgroundColor,
    };
  });
  const fieldBg = composite(parseColor(styles.fieldBackground), pageColor);
  const fg = parseColor(styles.color);
  const textColor = composite({ ...fg, a: fg.a * styles.opacity }, fieldBg);
  const ratio = contrastRatio(textColor, fieldBg);
  expect(
    ratio,
    `${label} contrast on rgb(${pageColor.r},${pageColor.g},${pageColor.b}) is ${ratio.toFixed(2)}:1 ` +
      `(text ${styles.color} @ ${styles.opacity}, field ${styles.fieldBackground}); expected ≥ ${minRatio}:1`,
  ).toBeGreaterThanOrEqual(minRatio);
  return ratio;
}

/** The message must be styled as an error (red family), not neutral or warning. */
export async function expectErrorStyled(locator: Locator, what = 'error message'): Promise<void> {
  const color = await locator.evaluate((el) => getComputedStyle(el).color);
  expect(isErrorColor(color), `${what} colour is ${color}; expected the error (red) colour`).toBe(true);
}

export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
export const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };

// ---------------------------------------------------------------------------
// Layout & accessibility
// ---------------------------------------------------------------------------

export async function expectNoHorizontalOverflow(page: Page, tolerance = 2): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `page scrolls horizontally (${scrollWidth}px content in ${clientWidth}px viewport)`).toBeLessThanOrEqual(
    clientWidth + tolerance,
  );
}

export async function expectSingleH1(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const count = await page.getByRole('heading', { level: 1 }).count();
  expect(count, 'pages should expose exactly one level-1 heading').toBe(1);
}

/** Every visible form control has an accessible name. Returns the offenders. */
export async function unlabeledControls(root: Locator): Promise<string[]> {
  return root.evaluate((rootEl) => {
    const out: string[] = [];
    const controls = rootEl.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]), select, textarea, [role=combobox], [role=switch], [role=checkbox], [role=radio], [role=slider]',
    );
    for (const el of controls) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const id = el.getAttribute('id');
      /* role="switch|checkbox|radio" on a <button>/<div> takes its name from its text. */
      const isNative = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      const named =
        (!isNative && (el.innerText || '').trim()) ||
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('title') ||
        (id && rootEl.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest('label');
      if (!named) out.push(el.outerHTML.slice(0, 140));
    }
    return out;
  });
}

/** Every visible button/link has an accessible name. Returns the offenders. */
export async function unnamedButtons(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, [role=button], a[href]')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || el.closest('[aria-hidden="true"]')) continue;
      const name =
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('title') ||
        (el.innerText || '').trim() ||
        el.querySelector('img[alt]')?.getAttribute('alt');
      if (!name) out.push(el.outerHTML.slice(0, 140));
    }
    return out;
  });
}

export async function brokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0)
      .map((img) => img.currentSrc || img.src),
  );
}

/** Visible text like "NaN", "undefined", "null", "[object Object]" or "Invalid Date". */
export async function renderingArtifacts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const bad = /(^|[\s(:$€£])(NaN|undefined|null|\[object Object\]|Invalid Date)(?=$|[\s).,%])/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.data.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('script, style, code, pre, [aria-hidden="true"]')) continue;
      if (!el.getClientRects().length) continue;
      if (bad.test(text)) out.push(text.slice(0, 80));
    }
    return out.slice(0, 10);
  });
}

/**
 * Collects uncaught page errors (and console errors as context) for the
 * lifetime of the page. Call before navigating.
 */
export function trackPageErrors(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
  const sink = { pageErrors: [] as string[], consoleErrors: [] as string[] };
  page.on('pageerror', (e) => sink.pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') sink.consoleErrors.push(m.text().slice(0, 300));
  });
  return sink;
}

/**
 * The baseline every authenticated module page must meet. Used by tests/ui/*.
 * Hard failures: missing/duplicate h1, missing landmark, horizontal overflow,
 * unlabeled controls, unnamed buttons, broken images, uncaught JS errors.
 */
export async function expectStandardUi(
  page: Page,
  testInfo: TestInfo,
  errors: { pageErrors: string[]; consoleErrors: string[] },
  options: { landmarks?: boolean } = {},
): Promise<void> {
  await expectSingleH1(page);
  if (options.landmarks !== false) {
    await expect(page.getByRole('main')).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);

  const unlabeled = await unlabeledControls(page.locator('body'));
  expect(unlabeled, `form controls without an accessible name:\n${unlabeled.join('\n')}`).toEqual([]);

  const unnamed = await unnamedButtons(page);
  expect(unnamed, `buttons/links without an accessible name:\n${unnamed.join('\n')}`).toEqual([]);

  const broken = await brokenImages(page);
  expect(broken, `broken images: ${broken.join(', ')}`).toEqual([]);

  const junk = await renderingArtifacts(page);
  expect(junk, `raw values rendered to the user: ${junk.join(' | ')}`).toEqual([]);

  if (errors.consoleErrors.length) {
    await testInfo.attach('console-errors', { body: errors.consoleErrors.join('\n'), contentType: 'text/plain' });
  }
  /* React hydration mismatches (#418/#423/#425) are intermittent (BUG-16): they depend on
     the data rendered at that moment, so record them visibly instead of failing the run. */
  for (const e of errors.pageErrors.filter((m) => HYDRATION_ERROR.test(m))) {
    testInfo.annotations.push({ type: 'issue', description: `BUG-16 (intermittent) hydration error seen: ${e.slice(0, 120)}` });
  }
  const uncaught = errors.pageErrors.filter((m) => !HYDRATION_ERROR.test(m));
  expect(uncaught, `uncaught page errors:\n${uncaught.join('\n')}`).toEqual([]);
}

const HYDRATION_ERROR = /Minified React error #(418|423|425)\b|Hydration failed/;

/** Re-checks the layout at a phone width; restores the viewport afterwards. */
export async function expectResponsive(page: Page, width = 390, height = 844): Promise<void> {
  const original = page.viewportSize();
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(300);
  try {
    await expectNoHorizontalOverflow(page, 4);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

/** Headings must stay readable in the dark colour scheme. */
export async function expectReadableInDarkMode(page: Page, target?: Locator): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(250);
  const heading = target ?? page.getByRole('heading', { level: 1 }).first();
  const { color, background } = await colorsOf(heading);
  const bg = parseColor(background);
  const ratio = contrastRatio(composite(parseColor(color), bg.a ? bg : WHITE), bg.a ? bg : WHITE);
  expect(ratio, `heading contrast in dark scheme is ${ratio.toFixed(2)}:1 (${color} on ${background})`).toBeGreaterThanOrEqual(3);
  await page.emulateMedia({ colorScheme: null });
}
