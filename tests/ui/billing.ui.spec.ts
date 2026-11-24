import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectOpenBugsToFail } from '../../src/helpers/bugs';
import { uiBaseline } from '../../src/helpers/uiSuite';
import { API } from '../../src/helpers/api';

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

  test('BIL-003 add-seats dialog previews the cost of the chosen seats', async ({ billingPage, page }) => {
    const usage = await (await page.request.get(API.billingUsage)).json();
    await billingPage.goto();
    const money = (t: string) => Number(t.replace(/[^\d.]/g, ''));
    const currentNext = money((await page.getByRole('region', { name: 'Subscription summary' }).getByRole('article', { name: 'Next invoice' }).getByRole('paragraph').nth(1).innerText()));

    await billingPage.openAddSeats();
    const dialog = billingPage.planDialog;
    const terms = dialog.locator('dt');
    const preview = async () => {
      const t = await terms.allInnerTexts();
      const v = await dialog.locator('dd').allInnerTexts();
      return (term: string) => v[t.indexOf(term)]?.trim() ?? '';
    };
    try {
      for (const seats of [1, 3]) {
        await billingPage.seatsInput.fill(String(seats));
        await expect(dialog.getByText(/seats? added/)).toContainText(`${seats} seat${seats === 1 ? '' : 's'} added`);
        await expect(dialog.locator('dd').first()).toHaveText(String(seats));
        /* The prices arrive with GET /billing/change-plan/preview; until then they read "—". */
        await expect(dialog.locator('dd').filter({ hasText: /^—$/ }), 'the price preview did not load').toHaveCount(0, { timeout: 20_000 });
        const value = await preview();
        const unit = money(value('Unit price'));
        expect(value('Unit price')).toMatch(/^\$[\d.]+ \/ seat \/ mo$/);
        await expect(dialog).toContainText(`$${(seats * unit).toFixed(2)}`);
        expect(money(value('Next invoice')), `${seats} seat(s): next invoice = current + seats × unit`).toBeCloseTo(currentNext + seats * unit, 2);
        /* Prorated for the rest of the cycle: seats × unit × remaining / period (the dialog rounds to cents). */
        const remaining = (Date.parse(usage.period_end) - Date.now()) / (Date.parse(usage.period_end) - Date.parse(usage.period_start));
        expect(money(value('Prorated today')), `${seats} seat(s): prorated today`).toBeCloseTo(seats * unit * remaining, 0);
        expect(money(value('Prorated today'))).toBeLessThanOrEqual(seats * unit);
      }
    } finally {
      /* Never confirm: Cancel leaves the subscription unchanged. */
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog).toBeHidden();
  });

  test('BUG-40 add-seats dialog starts at one additional seat', knownBug(KNOWN_BUGS.BUG40), async ({ billingPage }) => {
    expectOpenBugsToFail();
    await billingPage.goto();
    await billingPage.openAddSeats();
    try {
      await expect(billingPage.seatsInput, 'the dialog should not preselect more than one extra seat').toHaveValue(/^1?$/);
    } finally {
      await billingPage.planDialog.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('BUG-14 change-plan dialog pre-selects the current plan', knownBug(KNOWN_BUGS.BUG14), async ({ billingPage, page }) => {
    expectOpenBugsToFail();
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

test.describe('Billing · plan and payment options (nothing is confirmed)', () => {
  test('BIL-006 Enterprise is arranged with sales: no self-service checkout and no trial', async ({ billingPage, page }) => {
    await billingPage.goto();
    await billingPage.openChangePlan();
    const dialog = billingPage.planDialog;
    try {
      await billingPage.planOption('Enterprise').click();
      await expect(billingPage.planOption('Enterprise')).toHaveAttribute('aria-pressed', 'true');
      const notice = dialog.getByRole('status').filter({ hasText: 'Enterprise is arranged with our sales team' });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText('There is no self-service checkout or trial.');
      /* No price or charge is previewed, and the confirm action becomes "Contact sales". */
      const terms = await dialog.locator('dt').allInnerTexts();
      const values = await dialog.locator('dd').allInnerTexts();
      expect(values[terms.indexOf('Plan')]).toBe('Enterprise · Custom');
      expect(values[terms.indexOf('Prorated today')]).toBe('—');
      expect(values[terms.indexOf('Next invoice')]).toBe('—');
      await expect(dialog.getByRole('button', { name: /^(Switch plan|Schedule switch)$/ }), 'Enterprise cannot be bought in the dialog').toHaveCount(0);
      await expect(dialog.getByRole('link', { name: 'Contact sales' })).toHaveAttribute('href', /mailto:|\/contact|sales/i);
    } finally {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: /^Team|^Free|^Business/ }).first()).toBeVisible();
  });
});
