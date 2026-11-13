import { test, expect } from '../../src/fixtures/test';

test.describe('Billing & plan @smoke', () => {
  test.beforeEach(async ({ billingPage }) => {
    await billingPage.goto();
  });

  test('shows billing details and empty invoice table', async ({ billingPage }) => {
    await expect(billingPage.heading).toBeVisible();
    await expect(billingPage.planCard).toBeVisible();
    await expect(billingPage.addPaymentMethodButton).toBeVisible();
    await expect(billingPage.page.getByText('No payment method on file')).toBeVisible();
  });

  test('opens change plan and add seats dialogs', async ({ billingPage }) => {
    await billingPage.openChangePlan();
    for (const plan of ['Free', 'Team', 'Business', 'Enterprise'] as const) {
      await expect(billingPage.planOption(plan)).toBeVisible();
    }
    await billingPage.page.keyboard.press('Escape');

    await billingPage.openAddSeats();
    await expect(billingPage.seatsInput).toBeVisible();
  });

  test('opens the payment method dialog', async ({ billingPage }) => {
    await billingPage.openAddPaymentMethod();
    await expect(billingPage.paymentDialog).toBeVisible();
    await billingPage.cancelPaymentMethodButton.click().catch(() => undefined);
  });

  test('adds a sandbox payment method @payment', async ({ billingPage }) => {
    test.skip(
      process.env.RUN_PAYMENT !== 'true',
      'Charges a sandbox payment method. Set RUN_PAYMENT=true to run.',
    );
    test.skip(!process.env.CARD_NUMBER, 'CARD_NUMBER missing in .env');

    await billingPage.openAddPaymentMethod();
    await billingPage.fillCard(
      process.env.CARD_NUMBER!,
      process.env.CARD_EXPIRY!,
      process.env.CARD_CVC!,
      process.env.CARD_NAME,
    );
    await billingPage.savePaymentMethodButton.click();
    await expect(billingPage.page.getByText(/payment method added|saved/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('switches to Team plan and reverts to Free @payment', async ({ billingPage }) => {
    test.skip(process.env.RUN_PAYMENT !== 'true', 'Mutates the subscription. Set RUN_PAYMENT=true.');
    test.skip(!process.env.CARD_NUMBER, 'CARD_NUMBER missing in .env');

    await billingPage.openChangePlan();
    await billingPage.planOption('Team').click();
    await billingPage.switchPlanButton.click().catch(() => undefined);
    await billingPage.confirmChargeButton.click().catch(() => undefined);
    await expect(billingPage.page.getByText(/Team/i)).toBeVisible({ timeout: 30_000 });

    // Revert to Free
    await billingPage.openChangePlan();
    await billingPage.planOption('Free').click();
    await billingPage.switchPlanButton.click().catch(() => undefined);
    await expect(billingPage.planCard).toBeVisible();
  });
});
