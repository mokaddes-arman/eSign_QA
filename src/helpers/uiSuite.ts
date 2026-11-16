import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { expectReadableInDarkMode, expectResponsive, expectStandardUi, trackPageErrors } from './ui';
import { waitForHydration } from './wait';
import { expectBugsToFail, knownBug, type KnownBug } from './bugs';

export interface UiRoute {
  /** Short name used in the test title, e.g. "Contacts". */
  name: string;
  /** Path relative to BASE_URL. */
  path: string;
  /** Element that proves the page rendered (usually the h1). */
  ready: (page: Page) => Locator;
  /** Public page without a landmark-wrapped <main>, etc. */
  landmarks?: boolean;
  /** A known defect that makes this route's baseline fail (shown on the Known bugs tab). */
  bug?: KnownBug;
}

async function open(page: Page, route: UiRoute): Promise<void> {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  /* One reload if the backend timed out (see BasePage.recoverFromApiOutage). */
  if (await page.getByRole('alert').filter({ hasText: /reach the eSignPro API/ }).count()) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
  }
  await expect(route.ready(page)).toBeVisible({ timeout: 20_000 });
}

/**
 * Registers the three baseline UI checks for each route:
 *   1. standard UI (h1, landmarks, overflow, labels, names, images, raw values, JS errors)
 *   2. phone width (390 px) — no horizontal scroll, heading visible
 *   3. dark colour scheme — heading stays readable
 */
export function uiBaseline(routes: UiRoute[]): void {
  for (const route of routes) {
    const details = route.bug ? knownBug(route.bug) : {};
    test(`${route.name} meets the UI baseline`, details, async ({ page }, testInfo) => {
      test.fail(Boolean(route.bug) && expectBugsToFail, 'KNOWN_BUGS=expect-fail');
      const errors = trackPageErrors(page);
      await open(page, route);
      await expectStandardUi(page, testInfo, errors, { landmarks: route.landmarks });
    });

    test(`${route.name} fits a phone-width screen`, async ({ page }) => {
      await open(page, route);
      await expectResponsive(page);
    });

    test(`${route.name} stays readable in dark mode`, async ({ page }) => {
      await open(page, route);
      await expectReadableInDarkMode(page);
    });
  }
}

export { open as openRoute };
