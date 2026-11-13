import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** /login/verify — 6-digit e-mail confirmation step (signup + MFA sign-in). */
export class VerifyEmailPage extends BasePage {
  protected readonly path = '/login/verify';

  readonly heading = this.page.getByRole('heading', { name: /confirm your email|verify/i }).first();
  readonly codeInput = this.page.getByRole('textbox', { name: /verification code|6-digit code|code/i }).first();
  readonly verifyButton = this.page.getByRole('button', { name: /verify/i }).first();
  readonly resendButton = this.page.getByRole('button', { name: /resend/i }).first();
  readonly errorMessage = this.page.getByText(/invalid|incorrect|expired|wrong/i).first();

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.codeInput).toBeVisible();
  }

  async submitCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
    await this.verifyButton.click();
  }

  async resend(): Promise<void> {
    await this.resendButton.click();
  }
}
