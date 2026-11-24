import { test, expect } from '../../src/fixtures/test';
import { requireData } from '../../src/helpers/precondition';
import { API } from '../../src/helpers/api';
import { textsIn } from '../../src/helpers/ui';

test.describe('Billing & plan @smoke', () => {
  test.beforeEach(async ({ billingPage }) => {
    await billingPage.goto();
  });

  test('BIL-001 billing page shows the plan, seats, renewal and invoices of the subscription', async ({ billingPage, page }) => {
    const usage = await (await page.request.get(API.billingUsage)).json();
    const seats = usage.limits.max_documents_per_month.seats as number;
    /* Dates are formatted in the browser so they use the app's time zone. */
    const renews = await page.evaluate((iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), usage.period_end);
    const card = async (name: string) => textsIn(page.getByRole('region', { name: 'Subscription summary' }).getByRole('article', { name }), 'p');

    await expect(billingPage.heading).toBeVisible();
    await expect(billingPage.planCardFor(usage.plan_name)).toHaveText(new RegExp(`^${usage.plan_name}\\s*${usage.subscription_status}$`, 'i'));
    expect(await card('Seats'), 'Seats card vs billing API').toEqual(['Seats', String(seats), `${usage.limits.max_users.used} activated`]);
    expect((await card('Billing cycle'))[2], 'renewal date vs subscription period end').toBe(`renews ${renews}`);
    expect((await card('Next invoice'))[2], 'next invoice date vs subscription period end').toBe(renews);

    /* The plan line and the upcoming invoice agree: seats × unit price. */
    /* Exact plan region ("Team Active") — the sidebar widget is also named "Team plan · …". */
    const plan = page.getByRole('region', { name: new RegExp(`^${usage.plan_name}\\s*${usage.subscription_status}$`, 'i') });
    const line = (await plan.getByText(/\d+ seats? × \$[\d.,]+ · billed \w+/).innerText()).trim();
    const [, qty, unit] = line.match(/(\d+) seats? × \$([\d.,]+)/)!;
    expect(Number(qty), `"${line}"`).toBe(seats);
    const money = (t: string) => Number(t.replace(/[^\d.]/g, ''));
    const nextInvoice = money((await card('Next invoice'))[1]);
    expect(nextInvoice, 'Next invoice = seats × unit price').toBeCloseTo(seats * money(unit), 2);

    /* Payment methods: saved cards or the empty state, never a blank section. */
    await expect(billingPage.addPaymentMethodButton).toBeVisible();
    await expect(billingPage.paymentMethods.getByText(/No payment method on file|•••• \d{4}/).first(), 'Payment methods shows neither a saved card nor the empty state').toBeVisible();

    /* Invoices: the heading count equals the listed rows. */
    const list = page.getByRole('region', { name: /· \d+ invoices?$/ });
    const count = Number((await list.getByRole('heading', { level: 2 }).innerText()).match(/(\d+) invoices?/)![1]);
    await expect(list.getByRole('region', { name: 'Invoices', exact: true }).getByRole('row').filter({ has: page.getByRole('cell') })).toHaveCount(count);
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

  test('BIL-010 payment method offers Invoice / PO billing without card details', async ({ billingPage }) => {
    await billingPage.openAddPaymentMethod();
    const dialog = billingPage.paymentDialog;
    try {
      await expect(dialog.getByRole('button', { name: 'Card / bank' })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.locator('iframe').first(), 'the card tab holds the Stripe frame').toBeVisible();
      await dialog.getByRole('button', { name: 'Invoice / PO' }).click();
      await expect(dialog.getByRole('button', { name: 'Invoice / PO' })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByRole('textbox', { name: 'Purchase order number' })).toBeVisible();
      await expect(dialog).toContainText('Invoice-based billing is available on Enterprise. Net 30 terms');
      await expect(dialog.getByText('No card details are collected on this tab')).toBeVisible();
      await expect(dialog.locator('iframe'), 'no card frame on the invoice tab').toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Request invoice billing' })).toBeVisible();
    } finally {
      /* Nothing is requested: the dialog is cancelled. */
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog).toBeHidden();
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
