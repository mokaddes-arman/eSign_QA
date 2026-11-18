import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { TestUser } from '../config/env';

/**
 * The size `<select>` uses machine values ("1-50", "501-5000") while its
 * visible labels contain typographic dashes and thousands separators.
 * Normalise whatever a tester puts in `.env` to the underlying value.
 */
function companySizeValue(size: string): string {
  return size.replace(/[–—]/g, '-').replace(/,/g, '');
}

export class RegisterPage extends BasePage {
  protected readonly path = '/register';

  readonly heading = this.page.getByRole('heading', { name: 'Create your workspace' });
  readonly fullNameInput = this.page.getByRole('textbox', { name: 'Full name' });
  readonly companyInput = this.page.getByRole('textbox', { name: 'Company' });
  readonly emailInput = this.page.getByRole('textbox', { name: 'Work email' });
  readonly passwordInput = this.page.getByRole('textbox', { name: 'Password' });
  readonly showPasswordButton = this.healButton('Show password', false);
  readonly passwordHint = this.page.getByText(
    /Use 12\+ characters|^Weak$|^Medium$|^Strong$|^Excellent$/i,
  );
  readonly formStatus = this.page.getByRole('status');
  readonly companyTypeSelect = this.page.getByRole('combobox', { name: 'Company type' });
  readonly companySizeSelect = this.page.getByRole('combobox', { name: 'Company size' });
  readonly termsCheckbox = this.page.getByRole('checkbox', { name: /I agree to the Terms of Service/ });
  readonly createAccountButton = this.healButton('Create account', false);
  readonly signInTab = this.page.getByRole('tab', { name: 'Sign in' });
  readonly createAccountTab = this.page.getByRole('tab', { name: 'Create account' });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async fillForm(user: TestUser): Promise<void> {
    await this.fullNameInput.fill(user.name);
    await this.companyInput.fill(user.company);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.companyTypeSelect.selectOption({ label: user.companyType });
    await this.companySizeSelect.selectOption({ value: companySizeValue(user.companySize) });
    await this.termsCheckbox.check();
  }

  async submit(): Promise<void> {
    await expect(this.createAccountButton).toBeEnabled();
    await this.createAccountButton.click();
  }

  async expectValidationMessage(message: string | RegExp): Promise<void> {
    await expect(this.page.getByText(message).first()).toBeVisible();
  }
}
