import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectBugsToFail } from '../../src/helpers/bugs';
import { unlabeledControls } from '../../src/helpers/ui';
import { uiBaseline } from '../../src/helpers/uiSuite';

const h1 = (p: Page) => p.getByRole('heading', { level: 1 }).first();

/** Account & settings pages. Dialogs are opened and cancelled; nothing is saved. */
test.describe('UI · Account & settings', () => {
  uiBaseline([
    { name: 'Profile', path: '/account/profile', ready: h1 },
    { name: 'Login & security', path: '/account/security', ready: h1 },
    { name: 'Notification preferences', path: '/account/notifications', ready: h1 },
    { name: 'Integrations', path: '/account/integrations', ready: h1 },
    { name: 'Organization', path: '/account/organization', ready: h1 },
    { name: 'Audit trail', path: '/account/audit', ready: h1 },
    { name: 'Payments', path: '/account/payments', ready: h1 },
    { name: 'Branding', path: '/account/brand', ready: h1 },
    { name: 'Notifications centre', path: '/notifications', ready: h1 },
  ]);

  test('profile Save stays disabled until something changes', async ({ profilePage }) => {
    await profilePage.goto();
    await expect(profilePage.saveButton).toBeDisabled();
  });

  test('colour mode has exactly one option checked', async ({ profilePage }) => {
    await profilePage.goto();
    await expect(profilePage.themeGroup.getByRole('radio', { checked: true })).toHaveCount(1);
  });

  test('change-password dialog is labelled and cancellable', async ({ profilePage, page }) => {
    await profilePage.goto();
    await profilePage.openChangePassword();
    expect(await unlabeledControls(profilePage.changePasswordDialog)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(profilePage.changePasswordDialog).toBeHidden();
  });

  test('notification preferences expose switch state', async ({ page }) => {
    await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
    const switches = page.getByRole('switch');
    await expect(switches.first()).toBeVisible();
    expect(await switches.count()).toBeGreaterThanOrEqual(8);
  });

  test('BUG-12 organization headings separate the label from the count', knownBug(KNOWN_BUGS.BUG12), async ({ page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await page.goto('/account/organization', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const names = await page.getByRole('heading').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()));
    const glued = names.filter((n) => /[A-Za-z]\d+$/.test(n));
    expect(glued, `headings with a glued count: ${glued.join(', ')}`).toEqual([]);
  });
});
