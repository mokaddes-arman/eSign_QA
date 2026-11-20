import { test, expect } from '../../src/fixtures/test';
import { requireEnv } from '../../src/helpers/precondition';

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

  test('BIL-009 billing e-mail saves when the field loses focus and reverts @flow @data', async ({ billingPage, page }) => {
    /* Only the account's own mailbox: its address and a plus-alias of it. A cleared field is
       NOT saved (observation, 20 Nov 2026), so the test switches between the two and back. */
    const email = requireEnv('ESIGN_EMAIL', 'set a billing e-mail that belongs to the test account').toLowerCase();
    const [local, domain] = email.split('@');
    const alias = `${local}${local.includes('+') ? '-' : '+'}billing@${domain}`;
    await billingPage.goto();
    const field = billingPage.billingEmailInput;
    const original = (await field.inputValue()).toLowerCase();
    test.skip(![email, alias].includes(original) && original !== '', `Billing e-mail is set to another address (${original}); not touching it`);
    const next = original === alias ? email : alias;
    const save = async (value: string) => {
      await field.fill(value);
      await field.blur();
      await expect(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(field).toHaveValue(new RegExp(`^${value.replace(/[.+]/g, '\\$&')}$`, 'i'), { timeout: 5_000 });
      }, `billing e-mail "${value}" was not saved on blur`).toPass({ timeout: 40_000 });
    };
    try {
      await save(next);
    } finally {
      await save(original || email);
    }
  });
});
