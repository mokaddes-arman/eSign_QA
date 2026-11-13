import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  readonly heading = this.page.getByRole('heading', { name: /sign in|welcome back/i }).first();
  readonly emailInput = this.page.getByRole('textbox', { name: /email/i });
  readonly passwordInput = this.page.getByRole('textbox', { name: /password/i });
  readonly signInButton = this.page.getByRole('button', { name: 'Continue', exact: true });
  readonly rememberDeviceSwitch = this.page.getByRole('switch', { name: 'Remember this device' });
  readonly forgotPasswordLink = this.page.getByRole('link', { name: /forgot password/i });
  readonly registerLink = this.page.getByRole('link', { name: /create an account|start free|sign up/i });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.emailInput).toBeVisible();
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async openRegister(): Promise<void> {
    await this.registerLink.click();
  }
}
