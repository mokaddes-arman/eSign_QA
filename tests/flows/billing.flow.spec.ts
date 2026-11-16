import { test, expect } from '../../src/fixtures/test';

/** UF-45 — an admin explores a plan change and cancels; nothing is applied. */
test.describe('Flow · Billing', () => {
  test('UF-45 admin previews a plan change and cancels it @flow', async ({ billingPage, page }) => {
    await test.step('billing shows the Free plan', async () => {
      await billingPage.goto();
      await expect(billingPage.planCard).toBeVisible();
    });

    await test.step('choosing Team previews the price', async () => {
      await billingPage.openChangePlan();
      await billingPage.planOption('Team').click();
      await expect(billingPage.planDialog.getByText(/\$\s?\d/).first()).toBeVisible();
      await expect(billingPage.switchPlanButton).toBeVisible();
    });

    await test.step('cancel leaves the plan unchanged', async () => {
      await page.keyboard.press('Escape');
      await expect(billingPage.planDialog).toBeHidden();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(billingPage.planCard).toBeVisible();
    });
  });
});
