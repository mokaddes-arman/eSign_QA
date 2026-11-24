import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectOpenBugsToFail } from '../../src/helpers/bugs';
import { uiBaseline } from '../../src/helpers/uiSuite';

/** UI checks for the marketing site, as a guest (no session). */
test.use({ storageState: { cookies: [], origins: [] } });

const h1 = (page: Page) => page.getByRole('heading', { level: 1 }).first();

test.describe('UI · Public site', () => {
  uiBaseline([
    { name: 'Landing', path: '/', ready: h1 },
    { name: 'Pricing', path: '/pricing', ready: h1 },
    { name: 'Trust centre', path: '/trust', ready: h1 },
    { name: 'Security', path: '/security', ready: h1 },
    { name: 'Legal', path: '/legal', ready: h1 },
    { name: 'Changelog', path: '/changelog', ready: h1 },
    { name: 'Verify a document', path: '/verify', ready: h1 },
  ]);

  test('landing header exposes Log in and Start free', async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.loginLink).toBeVisible();
    await expect(homePage.startFreeLink).toBeVisible();
  });

  test('BUG-13 trust-centre hero has a correctly spaced accessible name', knownBug(KNOWN_BUGS.BUG13), async ({ page }) => {
    expectOpenBugsToFail();
    await page.goto('/trust', { waitUntil: 'domcontentloaded' });
    const accessible = await page.getByRole('heading', { level: 1 }).first().evaluate((el) => (el.textContent || '').trim());
    expect(accessible, `accessible name is "${accessible}"`).not.toMatch(/eSignProhandles/);
  });
});
