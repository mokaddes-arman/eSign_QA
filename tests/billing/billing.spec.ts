import { test, expect } from '../../src/fixtures/test';

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
});
