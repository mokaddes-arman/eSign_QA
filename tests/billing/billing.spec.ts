import { test, expect } from '../../src/fixtures/test';
import { requireData } from '../../src/helpers/precondition';

test.describe('Billing & plan @smoke', () => {
  test.beforeEach(async ({ billingPage }) => {
    await billingPage.goto();
  });

  test('shows billing details and empty invoice table', async ({ billingPage }) => {
    await expect(billingPage.heading).toBeVisible();
    await expect(billingPage.planCard).toBeVisible();
    await expect(billingPage.addPaymentMethodButton).toBeVisible();
    /* Either the empty state or a saved card — never a blank section. */
    await expect(
      billingPage.paymentMethods.getByText(/No payment method on file|•••• \d{4}/).first(),
      'Payment methods shows neither a saved card nor the empty state',
    ).toBeVisible();
  });

  test('opens change plan and add seats dialogs', async ({ billingPage }) => {
    await billingPage.openChangePlan();
    for (const plan of ['Free', 'Team', 'Business', 'Enterprise'] as const) {
      await expect(billingPage.planOption(plan)).toBeVisible();
    }
    await billingPage.page.keyboard.press('Escape');
    await expect(billingPage.planDialog, 'The Change plan dialog did not close').toBeHidden();

    await billingPage.openAddSeats();
    await expect(billingPage.seatsInput).toBeVisible();
  });

  test('opens the payment method dialog', async ({ billingPage }) => {
    await billingPage.openAddPaymentMethod();
    await expect(billingPage.paymentDialog).toBeVisible();
    await billingPage.cancelPaymentMethodButton.click().catch(() => undefined);
  });

  test('BIL-008 invoices list opens an invoice whose lines add up', async ({ page }) => {
    const list = page.getByRole('region', { name: /· \d+ invoices?$/ });
    await expect(list).toBeVisible({ timeout: 30_000 });
    const count = Number((await list.getByRole('heading', { level: 2 }).innerText()).match(/(\d+) invoices?/)![1]);
    requireData(count > 0, 'the workspace has no issued invoice');
    const rows = list.getByRole('region', { name: 'Invoices', exact: true }).getByRole('row').filter({ has: page.getByRole('button') });
    await expect(rows).toHaveCount(count);
    await expect(list.getByRole('group', { name: 'Filter invoices by status' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    const number = (await rows.first().getByRole('button').innerText()).split(/\s/)[0];
    await rows.first().getByRole('button').click();
    const heading = page.getByRole('heading', { level: 2, name: number, exact: true });
    await expect(heading).toBeVisible();
    /* dt/dd, not getByRole('term') inside a role=region: that combination crashes the Firefox tab. */
    const detail = page.locator('section, [role=region]').filter({ has: heading }).last();
    /* Terms and definitions are paired by position: Subtotal + Tax = Total. */
    const terms = await detail.locator('dt').allInnerTexts();
    const values = await detail.locator('dd').allInnerTexts();
    const money = (term: string) => Number(values[terms.indexOf(term)].replace(/[^\d.]/g, ''));
    expect(money('Subtotal') + money('Tax')).toBeCloseTo(money('Total'), 2);
    for (const action of ['View receipt', 'Download PDF', 'Email receipt']) await expect(detail.getByRole('button', { name: action })).toBeVisible();
  });
});
