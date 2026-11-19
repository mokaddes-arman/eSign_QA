import { expect, type Frame } from '@playwright/test';
import { BasePage } from './BasePage';
import { clickUntilVisible } from '../helpers/wait';

export class BillingPage extends BasePage {
  protected readonly path = '/account/billing';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Billing & plan' });
  /* Plan card heading renders as "<Plan> Active" (name + status badge) — any plan. */
  readonly planCard = this.page.getByRole('heading', { level: 2, name: /^(Free|Team|Business|Enterprise)\b/ });
  planCardFor(plan: string) {
    return this.page.getByRole('heading', { level: 2, name: new RegExp(`^${plan}\\b`, 'i') });
  }
  /** "Plan change scheduled · Free starts <date>" banner shown after a downgrade. */
  readonly scheduledChange = this.page.getByText('Plan change scheduled');
  readonly keepPlanButton = this.page.getByRole('button', { name: /^Keep (Team|Business|Enterprise)/ });
  readonly changePlanButton = this.healButton('Change plan', false);
  readonly addSeatsButton = this.healButton('Add seats', false);
  readonly addPaymentMethodButton = this.healButton('Add payment method', false);
  readonly allInvoicesButton = this.healButton('All invoices & receipts', false);
  readonly invoicesTable = this.page.getByRole('table');
  readonly billingEmailInput = this.page.getByRole('textbox', { name: 'Billing email' });
  readonly billingCycleGroup = this.page.getByRole('group', { name: /Billing cycle/ });

  readonly planDialog = this.page.getByRole('dialog');
  readonly paymentDialog = this.page.getByRole('dialog');
  readonly seatsInput = this.planDialog.getByRole('spinbutton', { name: 'Additional seats' });
  /* "Switch plan" for upgrades (charged now); "Schedule switch" for downgrades (at renewal). */
  readonly switchPlanButton = this.planDialog.getByRole('button', { name: /^(Switch plan|Schedule switch)$/ });
  readonly confirmChargeButton = this.planDialog.getByRole('button', { name: /Confirm & charge/ });
  readonly savePaymentMethodButton = this.paymentDialog.getByRole('button', { name: /Save|Add|Confirm/i });
  readonly cancelPaymentMethodButton = this.paymentDialog.getByRole('button', { name: /Cancel|Close/i });

  /** The "Payment methods" section; saved cards render as "•••• •••• •••• 4242". */
  readonly paymentMethods = this.page.getByRole('region', { name: 'Payment methods' });
  savedCard(last4: string) {
    return this.paymentMethods.getByText(new RegExp(`•••• ${last4}\\b`)).first();
  }

  async openAddPaymentMethod(): Promise<void> {
    /* The dialog opens only after POST /billing/setup-session returns (several seconds
       under load); re-clicking sooner interferes with the request in flight. */
    await clickUntilVisible(this.addPaymentMethodButton, this.paymentDialog, {
      what: 'The Add payment method dialog did not open (Stripe setup session not created)',
      attemptTimeout: 15_000,
      timeout: 45_000,
    });
  }

  /**
   * Stripe Embedded Checkout (setup mode) is an iframe inside the dialog. Its card
   * accordion button is visually covered by its own label, so the label is clicked.
   */
  async checkoutFrame(): Promise<Frame> {
    let frame: Frame | undefined;
    await expect
      .poll(() => (frame = this.page.frames().find((f) => /embedded-checkout-inner/.test(f.url()))) !== undefined, {
        message: 'Stripe Checkout did not load inside the payment dialog',
        timeout: 30_000,
      })
      .toBe(true);
    await expect(frame!.locator('#payment-method-label-card, #cardNumber').first(), 'Stripe Checkout shows no card option').toBeVisible({ timeout: 30_000 });
    return frame!;
  }

  async fillCard(card: { number: string; expiry: string; cvc: string; name: string; country: string; email: string }): Promise<void> {
    const frame = await this.checkoutFrame();
    const email = frame.locator('#email');
    if (await email.isVisible().catch(() => false)) await email.fill(card.email);
    if (!(await frame.locator('#cardNumber').isVisible().catch(() => false))) {
      await frame.locator('#payment-method-label-card').click({ force: true });
    }
    await frame.locator('#cardNumber').fill(card.number);
    await frame.locator('#cardExpiry').fill(card.expiry);
    await frame.locator('#cardCvc').fill(card.cvc);
    await frame.locator('#billingName').fill(card.name);
    /* Stripe pre-selects the visitor's country; pick the configured one (value or label). */
    const country = frame.locator('#billingCountry');
    await country.selectOption(card.country).catch(() => country.selectOption({ label: card.country }));
    await expect(country, `Stripe Checkout did not accept country "${card.country}"`).toHaveValue(/.+/);
    const postal = frame.locator('#billingPostalCode');
    if (await postal.isVisible().catch(() => false)) await postal.fill('10001');
  }

  async submitCard(): Promise<void> {
    const frame = await this.checkoutFrame();
    await frame.getByRole('button', { name: /^Save/ }).click();
    const closed = await this.paymentDialog.waitFor({ state: 'hidden', timeout: 60_000 }).then(() => true, () => false);
    if (!closed) {
      /* Say WHY: Stripe shows field errors or a decline message inside its frame. */
      const reasons = await frame
        .locator('[role="alert"], .FieldError, .Error, [class*="error" i]')
        .allInnerTexts()
        .then((t) => t.map((x) => x.trim()).filter(Boolean).slice(0, 3))
        .catch(() => [] as string[]);
      const captcha = this.page.frames().some((f) => /hcaptcha.*challenge|challenge.*hcaptcha/i.test(f.url()));
      throw new Error(
        `Stripe did not accept the card (the payment dialog stayed open). ` +
          (reasons.length ? `Stripe says: ${reasons.join(' | ')}` : captcha ? 'Stripe showed an hCaptcha challenge (anti-bot), which automation cannot solve.' : 'No error was shown in the checkout.'),
      );
    }
  }

  /** Current plan code from the billing API (free | team | business | enterprise). */
  async planCode(): Promise<string> {
    const usage = await (await this.page.request.get('/api/proxy/billing/usage')).json();
    return usage.plan_code;
  }

  /**
   * Picks a plan in Change plan and confirms it, then waits until the billing API
   * reports the new plan (Stripe → webhook → backend can take a few seconds).
   */
  async switchPlan(name: 'Free' | 'Team' | 'Business'): Promise<void> {
    await this.openChangePlan();
    await this.planOption(name).click();
    await expect(this.planOption(name)).toHaveAttribute('aria-pressed', 'true');
    await this.switchPlanButton.click();
    /* Upgrading opens Stripe Checkout (subscription mode) in the dialog: pay in USD
       with the saved card and subscribe. Downgrades confirm in the app instead. */
    const checkout = await expect
      .poll(() => this.page.frames().find((f) => /embedded-checkout-inner/.test(f.url())) ?? null, { timeout: 15_000 })
      .not.toBeNull()
      .then(() => this.page.frames().find((f) => /embedded-checkout-inner/.test(f.url()))!)
      .catch(() => null);
    if (checkout) {
      const usd = checkout.getByRole('button', { name: /USD/ }).or(checkout.getByText(/^USD$/)).first();
      if (await usd.isVisible({ timeout: 10_000 }).catch(() => false)) await usd.click();
      const submit = checkout.getByRole('button', { name: /^(Subscribe|Pay|Start|Confirm)/ }).last();
      await expect(submit, 'Stripe Checkout has no Subscribe/Pay button').toBeVisible({ timeout: 30_000 });
      await submit.click();
      await expect(this.planDialog, 'Stripe Checkout did not complete the subscription').toBeHidden({ timeout: 90_000 });
    } else {
      const confirm = this.planDialog.getByRole('button', { name: /^(Confirm|Confirm & charge|Downgrade|Switch)/ });
      if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.first().click();
    }
    await expect
      .poll(() => this.planCode(), { message: `The workspace did not switch to the ${name} plan`, timeout: 60_000, intervals: [2_000] })
      .toBe(name.toLowerCase());
  }

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openChangePlan(): Promise<void> {
    await clickUntilVisible(this.changePlanButton, this.planDialog.getByRole('heading', { name: 'Change plan' }), { what: "The Change plan dialog did not open" });
  }

  async openAddSeats(): Promise<void> {
    await clickUntilVisible(this.addSeatsButton, this.planDialog.getByRole('heading', { name: 'Add seats' }), { what: "The Add seats dialog did not open" });
  }

  planOption(name: 'Free' | 'Team' | 'Business' | 'Enterprise') {
    return this.planDialog.getByRole('button', { name: new RegExp(`^${name}`) });
  }
}
