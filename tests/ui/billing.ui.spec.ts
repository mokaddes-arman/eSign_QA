import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectBugsToFail } from '../../src/helpers/bugs';
import { uiBaseline } from '../../src/helpers/uiSuite';

/** Billing UI. Dialogs are opened and cancelled; no plan or card change is confirmed. */
test.describe('UI · Billing & plan', () => {
  uiBaseline([
    { name: 'Billing', path: '/account/billing', ready: (p) => p.getByRole('heading', { level: 1, name: 'Billing & plan' }) },
  ]);

  test('summary cards render and plan data is not blank', async ({ billingPage, page }) => {
    await billingPage.goto();
    for (const label of ['Seats', 'Next invoice', 'Billing cycle', 'Account balance']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/— Inactive|no renewal scheduled/i), 'plan data missing (FEATURES O1)').toHaveCount(0);
  });

  test('add-seats dialog previews the cost', async ({ billingPage, page }) => {
    await billingPage.goto();
    await billingPage.openAddSeats();
    await expect(billingPage.planDialog.getByText(/prorated|today/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('BUG-14 change-plan dialog pre-selects the current plan', knownBug(KNOWN_BUGS.BUG14), async ({ billingPage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await billingPage.goto();
    await billingPage.openChangePlan();
    const selected = billingPage.planDialog
      .locator('[aria-pressed="true"], [aria-checked="true"], [aria-selected="true"]')
      .first();
    await expect(selected).toBeVisible();
    const plan = await billingPage.planCode();
    const name = plan.charAt(0).toUpperCase() + plan.slice(1);
    await expect(selected, `the workspace is on ${name}; the dialog should pre-select ${name}`).toContainText(new RegExp(`^\\s*${name}`));
    await page.keyboard.press('Escape');
  });
});
