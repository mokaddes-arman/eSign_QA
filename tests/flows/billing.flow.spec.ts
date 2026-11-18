import { test, expect } from '../../src/fixtures/test';

/** UF-45 — an admin explores a plan change and cancels; nothing is applied. */
test.describe('Flow · Billing', () => {
  test('UF-45 admin previews a plan change and cancels it @flow', async ({ billingPage, page }) => {
    const before = await billingPage.planCode();
    const other = before === 'business' ? 'Team' : 'Business';

    await test.step('billing shows the current plan', async () => {
      await billingPage.goto();
      await expect(billingPage.planCardFor(before)).toBeVisible();
    });

    await test.step(`choosing ${other} previews the price`, async () => {
      await billingPage.openChangePlan();
      await billingPage.planOption(other).click();
      await expect(billingPage.planOption(other)).toHaveAttribute('aria-pressed', 'true');
      await expect(billingPage.planDialog.getByText(/\$\s?\d/).first()).toBeVisible();
      await expect(billingPage.switchPlanButton).toBeVisible();
    });

    await test.step('cancel leaves the plan unchanged', async () => {
      await page.keyboard.press('Escape');
      await expect(billingPage.planDialog).toBeHidden();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(billingPage.planCardFor(before)).toBeVisible();
      expect(await billingPage.planCode(), 'Cancelling the dialog must not change the plan').toBe(before);
    });
  });
});
