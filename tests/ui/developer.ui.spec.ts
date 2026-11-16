import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectBugsToFail } from '../../src/helpers/bugs';
import { uiBaseline } from '../../src/helpers/uiSuite';

const h1 = (p: Page) => p.getByRole('heading', { level: 1 }).first();

/** Developer platform UI. "Create key" is never clicked (it creates a live key instantly). */
test.describe('UI · Developer platform', () => {
  uiBaseline([
    { name: 'API overview', path: '/developer/api', ready: h1 },
    { name: 'API keys', path: '/developer/api?section=keys', ready: h1 },
    { name: 'Endpoints', path: '/developer/api?section=endpoints', ready: h1 },
    { name: 'Webhooks', path: '/developer/api?section=webhooks', ready: h1 },
    { name: 'Plan usage', path: '/developer/api?section=usage', ready: h1 },
    { name: 'API console', path: '/developer/sandbox', ready: h1 },
    { name: 'Guides', path: '/developer/guides', ready: h1 },
    /* BUG-16 (React hydration error) was seen here repeatedly on 16 Nov but is intermittent;
       the baseline records it as an `issue` annotation instead of failing. */
    { name: 'Activity logs', path: '/developer/logs', ready: h1 },
    { name: 'Partner program', path: '/developer/partner', ready: h1 },
  ]);

  test('section tabs mark the active section', async ({ developerPage, page }) => {
    await page.goto('/developer/api?section=webhooks', { waitUntil: 'domcontentloaded' });
    await expect(developerPage.section('Webhooks')).toHaveAttribute('aria-current', /page|true/);
  });

  test('BUG-18 webhook dialog keeps Create disabled for an invalid URL', knownBug(KNOWN_BUGS.BUG18), async ({ developerPage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await developerPage.goto();
    await developerPage.openSection('Webhooks');
    await page.getByRole('button', { name: 'Add endpoint' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add endpoint' });
    const create = dialog.getByRole('button', { name: /Create endpoint/ });
    await expect(create, 'Create must be disabled while the URL is empty').toBeDisabled();
    try {
      await dialog.getByRole('textbox', { name: /Endpoint URL/ }).fill('not a url');
      await expect(create, 'Create became enabled for "not a url"').toBeDisabled({ timeout: 3_000 });
    } finally {
      /* Never submit: cancel so no webhook endpoint is created. */
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    }
  });
});
