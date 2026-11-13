import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BillingPage extends BasePage {
  protected readonly path = '/account/billing';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Billing & plan' });
  /* Plan card heading renders as "Free Active" (name + status badge). */
  readonly planCard = this.page.getByRole('heading', { level: 2, name: /^Free\b/ });
  readonly changePlanButton = this.page.getByRole('button', { name: 'Change plan' });
  readonly addSeatsButton = this.page.getByRole('button', { name: 'Add seats' });
  readonly addPaymentMethodButton = this.page.getByRole('button', { name: 'Add payment method' });
  readonly allInvoicesButton = this.page.getByRole('button', { name: 'All invoices & receipts' });
  readonly invoicesTable = this.page.getByRole('table');
  readonly billingEmailInput = this.page.getByRole('textbox', { name: 'Billing email' });
  readonly billingCycleGroup = this.page.getByRole('group', { name: /Billing cycle/ });

  readonly planDialog = this.page.getByRole('dialog');
  readonly paymentDialog = this.page.getByRole('dialog');
  readonly seatsInput = this.planDialog.getByRole('spinbutton', { name: 'Additional seats' });
  readonly switchPlanButton = this.planDialog.getByRole('button', { name: 'Switch plan' });
  readonly confirmChargeButton = this.planDialog.getByRole('button', { name: /Confirm & charge/ });
  readonly savePaymentMethodButton = this.paymentDialog.getByRole('button', { name: /Save|Add|Confirm/i });
  readonly cancelPaymentMethodButton = this.paymentDialog.getByRole('button', { name: /Cancel|Close/i });

  stripeFrame() {
    return this.page.frameLocator('iframe').first();
  }

  async openAddPaymentMethod(): Promise<void> {
    await this.addPaymentMethodButton.click();
    await expect(this.paymentDialog).toBeVisible();
  }

  async fillCard(cardNumber: string, expiry: string, cvc: string, name?: string): Promise<void> {
    const frame = this.stripeFrame();
    await frame.getByPlaceholder(/card number/i).fill(cardNumber);
    await frame.getByPlaceholder(/MM.*YY|expiry/i).fill(expiry);
    await frame.getByPlaceholder(/CVC|security code/i).fill(cvc);
    if (name) {
      const nameField = this.paymentDialog.getByRole('textbox', { name: /name on card|cardholder/i });
      if (await nameField.isVisible().catch(() => false)) await nameField.fill(name);
    }
  }

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openChangePlan(): Promise<void> {
    await this.changePlanButton.click();
    await expect(this.planDialog.getByRole('heading', { name: 'Change plan' })).toBeVisible();
  }

  async openAddSeats(): Promise<void> {
    await this.addSeatsButton.click();
    await expect(this.planDialog.getByRole('heading', { name: 'Add seats' })).toBeVisible();
  }

  planOption(name: 'Free' | 'Team' | 'Business' | 'Enterprise') {
    return this.planDialog.getByRole('button', { name: new RegExp(`^${name}`) });
  }
}
