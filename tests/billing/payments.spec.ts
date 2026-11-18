import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { requireEnv } from '../../src/helpers/precondition';

/*
 * Subscription payments through Stripe — STRIPE TEST MODE ONLY.
 *
 * The site's checkout uses pk_test_ keys ("Stripe test mode · no real money moves"),
 * verified before these tests were enabled. Card details come from .env (CARD_*).
 * They change account state (a saved test card; a plan change that is reverted), so
 * they run in the serial `chromium-account` project after every other Chromium test.
 * Cases BIL-004 (add card), BIL-007 (plan change charged and reverted), BIL-012 (proration).
 */
const card = () => ({
  number: requireEnv('CARD_NUMBER', 'enter the Stripe test card'),
  expiry: requireEnv('CARD_EXPIRY', 'enter the card expiry'),
  cvc: requireEnv('CARD_CVC', 'enter the card CVC'),
  name: requireEnv('CARD_NAME', 'enter the card holder'),
  country: process.env.CARD_COUNTRY || 'US',
  email: 'qa.payments@example.com',
});
/* Stripe's Visa field keeps 16 digits; the saved card shows the last four of those. */
const last4 = (n: string) => n.replace(/\D/g, '').slice(0, 16).slice(-4);

test.describe('Billing · payments (Stripe test mode) @payment', () => {
  /* No serial mode: a failure must never stop (skip) the next case. Ordering and
     isolation come from the single-worker `chromium-account` project. */

  test.beforeEach(async ({ billingPage }) => {
    await billingPage.goto();
    /* Guard: never enter a card unless the checkout is in Stripe TEST mode. */
    await billingPage.openAddPaymentMethod();
    await expect(
      billingPage.paymentDialog.getByText(/Stripe test mode/i),
      'Stripe is not in test mode — refusing to enter card details',
    ).toBeVisible();
    await billingPage.page.keyboard.press('Escape');
    await expect(billingPage.paymentDialog).toBeHidden();
  });

  test('BIL-004 adds a card through Stripe Checkout and lists it as a payment method', async ({ billingPage, page }) => {
    const c = card();
    const cardsBefore = await billingPage.paymentMethods.getByText(/•••• •••• •••• \d{4}/).count();

    await billingPage.openAddPaymentMethod();
    await billingPage.fillCard(c);
    await billingPage.submitCard();

    /* The card reaches the app through Stripe's webhook, so it appears after a short delay. */
    await expect(async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(billingPage.savedCard(last4(c.number))).toBeVisible({ timeout: 5_000 });
      expect(await billingPage.paymentMethods.getByText(/•••• •••• •••• \d{4}/).count()).toBeGreaterThan(cardsBefore);
    }, `The saved card •••• ${last4(c.number)} did not appear under Payment methods`).toPass({ timeout: 90_000, intervals: [3_000] });
    await expect(billingPage.paymentMethods.getByRole('switch', { name: 'Autopay' })).toBeVisible();
  });

  test('BIL-012 change-plan preview prorates the price over the rest of the billing period', async ({ billingPage, request }) => {
    /* Per-seat monthly prices (pricing page). Preview the next plan up from the current one. */
    const PRICE: Record<string, number> = { free: 0, team: 12, business: 28 };
    const usage = await (await request.get(API.billingUsage)).json();
    const current = usage.plan_code as string;
    const target = current === 'free' ? 'Team' : 'Business';
    const start = Date.parse(usage.period_start);
    const end = Date.parse(usage.period_end);
    /* Upgrade charges the price difference for the rest of the period (1 seat). */
    const expected = ((PRICE[target.toLowerCase()] - PRICE[current]) * (end - Date.now())) / (end - start);

    await billingPage.openChangePlan();
    await billingPage.planOption(target).click();
    await expect(billingPage.planOption(target)).toHaveAttribute('aria-pressed', 'true');
    const dialog = billingPage.planDialog;
    /* The preview is a description list: <dt>Prorated today</dt><dd>$9.99</dd>. */
    /* The preview is computed after the plan is picked ("—" until then), so wait for a number. */
    const amount = async (term: string) => {
      const read = () =>
        dialog.evaluate((el, t) => {
          const dt = [...el.querySelectorAll('dt, [role="term"]')].find((x) => x.textContent?.trim() === t);
          return dt?.nextElementSibling?.textContent?.trim() ?? '';
        }, term);
      await expect.poll(read, { message: `Change-plan preview never showed an amount for "${term}"`, timeout: 20_000 }).toMatch(/\d/);
      return Number((await read()).replace(/[^0-9.]/g, ''));
    };
    /* The preview recalculates asynchronously after a click; until its "Plan" line names
       the chosen plan, the amounts still belong to the previous selection. */
    await expect(
      dialog.getByRole('definition').filter({ hasText: new RegExp(`^${target}\\b`) }),
      `The change-plan preview never switched to ${target}`,
    ).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Prorated today')).toBeVisible();
    const prorated = await amount('Prorated today');
    const next = await amount('Next invoice');
    expect(next, `Next invoice for ${target} with 1 seat`).toBeCloseTo(PRICE[target.toLowerCase()], 2);
    expect(Math.abs(prorated - expected), `Prorated today is $${prorated}; expected ≈ $${expected.toFixed(2)} for the rest of the period`).toBeLessThanOrEqual(0.15);
    await expect(dialog.getByText(/•••• \d{4}/), 'The card that will be charged is shown').toBeVisible();
    await billingPage.page.keyboard.press('Escape');
  });

  /*
   * Plan lifecycle. Upgrades are charged at once through Stripe Checkout; downgrades are
   * SCHEDULED for the end of the period ("Free starts <date> · you keep Team until then").
   * So the test is a state machine that is valid on every run and charges at most once
   * per billing period:
   *   Free                         → upgrade to Team (test card charged), then schedule Free
   *   Team + Free scheduled        → "Keep Team" cancels it, then schedule Free again
   *   Team, nothing scheduled      → schedule Free
   * Each run ends with the downgrade scheduled, so the workspace returns to Free at renewal.
   */
  test('BIL-007 plan lifecycle: upgrade is charged, downgrade is scheduled and can be cancelled', async ({ billingPage, page }) => {
    test.setTimeout(300_000); /* Stripe round-trips + webhooks */
    const usage = async () => (await page.request.get(API.billingUsage)).json();

    if ((await billingPage.planCode()) === 'free') {
      await test.step('upgrade Free → Team through Stripe Checkout', async () => {
        await billingPage.switchPlan('Team');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(billingPage.planCardFor('Team'), 'Plan card shows Team after the upgrade').toBeVisible({ timeout: 20_000 });
        expect((await usage()).limits.max_documents_per_month.limit, 'Team allowance is larger than Free (6)').toBeGreaterThan(6);
        await expect(page.getByText(/1 × Team \(at \$12\.00 \/ month\)|Team plan/).first(), 'An invoice line for Team is issued').toBeVisible();
      });
    }

    await test.step('plan is Team', async () => {
      expect(await billingPage.planCode()).toBe('team');
      await expect(billingPage.planCardFor('Team')).toBeVisible();
    });

    if (await billingPage.scheduledChange.isVisible().catch(() => false)) {
      await test.step('"Keep Team" cancels the scheduled downgrade', async () => {
        await billingPage.keepPlanButton.click();
        await expect(billingPage.scheduledChange, 'Keep Team did not cancel the scheduled downgrade').toBeHidden({ timeout: 20_000 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(billingPage.scheduledChange, 'The cancelled downgrade came back after reload').toBeHidden({ timeout: 10_000 });
      });
    }

    await test.step('downgrade Team → Free is scheduled for the end of the period', async () => {
      const renews = (await usage()).period_end as string;
      const day = new Date(renews).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

      await billingPage.openChangePlan();
      await billingPage.planOption('Free').click();
      await expect(billingPage.planOption('Free')).toHaveAttribute('aria-pressed', 'true');
      const dialog = billingPage.planDialog;
      await expect(dialog.getByRole('definition').filter({ hasText: day }), `Preview should say Free starts at renewal (${day})`).toBeVisible();
      await expect(dialog.getByText(/Nothing · you keep Team until then/), 'A downgrade must not charge anything today').toBeVisible();
      await expect(billingPage.switchPlanButton, 'Downgrades are confirmed with "Schedule switch"').toHaveText('Schedule switch');
      await billingPage.switchPlanButton.click();

      /* The schedule is stored through Stripe; the banner appears once the page re-reads it. */
      await expect(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(billingPage.scheduledChange).toBeVisible({ timeout: 5_000 });
      }, 'No "Plan change scheduled" banner after scheduling the switch to Free').toPass({ timeout: 60_000, intervals: [3_000] });
      await expect(page.getByText(/Free starts/), `The downgrade should start at renewal (${day})`).toContainText(day);
      expect(await billingPage.planCode(), 'The workspace keeps Team until the period ends').toBe('team');
    });
  });
});
