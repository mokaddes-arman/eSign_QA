import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { clickUntilVisible } from '../helpers/wait';

export class AccountProfilePage extends BasePage {
  protected readonly path = '/account/profile';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'User profile' });
  readonly fullNameInput = this.page.getByRole('textbox', { name: 'Full name' });
  readonly emailInput = this.page.getByRole('textbox', { name: 'Email' });
  readonly timeZoneSelect = this.page.getByLabel('Time zone');
  readonly languageSelect = this.page.getByLabel('Language');
  readonly saveButton = this.healButton('Save changes', false);
  readonly changePasswordButton = this.healButton('Change password', false);
  readonly addSignatureButton = this.healButton('Add signature', false);
  readonly addPhotoButton = this.healButton('Add photo', false);

  readonly themeGroup = this.page.getByRole('radiogroup', { name: 'Colour mode' });
  readonly lightTheme = this.page.getByRole('radio', { name: 'Light' });
  readonly darkTheme = this.page.getByRole('radio', { name: 'Dark' });
  readonly systemTheme = this.page.getByRole('radio', { name: 'Match system' });

  readonly signaturesHeading = this.page.getByText('Signatures', { exact: true });
  readonly signatureEmptyState = this.page.getByText('No signature adopted yet');

  readonly changePasswordDialog = this.page.getByRole('dialog');
  readonly currentPasswordInput = this.changePasswordDialog.getByLabel('Current password');
  readonly signatureDialog = this.page.getByRole('dialog');

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openChangePassword(): Promise<void> {
    await clickUntilVisible(this.changePasswordButton, this.changePasswordDialog, { what: "The Change password dialog did not open" });
  }

  async openSignatureDialog(): Promise<void> {
    await this.addSignatureButton.click();
    await expect(this.signatureDialog.getByRole('heading', { name: /Adopt your signature|Add signature/i })).toBeVisible();
  }
}
