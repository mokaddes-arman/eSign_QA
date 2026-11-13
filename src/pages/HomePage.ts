import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  protected readonly path = '/';

  readonly loginLink = this.page.getByRole('link', { name: 'Log in', exact: true });
  readonly startFreeLink = this.page
    .getByRole('banner')
    .getByRole('link', { name: 'Start free' });
  readonly heroHeading = this.page.getByRole('heading', { level: 1 });
  readonly pricingSection = this.page.locator('#pricing');

  async openLogin(): Promise<void> {
    await this.loginLink.click();
    await expect(this.page).toHaveURL(/\/login/);
  }

  async openRegister(): Promise<void> {
    await this.startFreeLink.click();
    await expect(this.page).toHaveURL(/\/register/);
  }
}
