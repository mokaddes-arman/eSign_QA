import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** /documents/{id}/prepare — field placement builder. */
export class PreparePage extends BasePage {
  protected readonly path = '/documents/prepare';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Prepare document' });
  readonly fileInput = this.page.locator('input[type=file]').first();
  readonly sendForSignatureButton = this.page.getByRole('button', { name: 'Send for signature' });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue', exact: true });
  readonly workflowButton = this.page.getByRole('button', { name: 'Workflow', exact: true });
  readonly previewLink = this.page.getByRole('link', { name: 'Preview' });
  readonly downloadPdfButton = this.page.getByRole('button', { name: 'Download PDF' });
  readonly saveAsTemplateButton = this.page.getByRole('button', { name: 'Save as template' });
  readonly saveAndCloseButton = this.page.getByRole('button', { name: 'Save and close' });

  readonly recipientsRegion = this.page.getByRole('region', { name: 'Recipients' });
  readonly addRecipientButton = this.recipientsRegion.getByRole('button', { name: 'Add recipient' });
  readonly manageRecipientsButton = this.recipientsRegion.getByRole('button', { name: 'Manage recipients' });

  readonly fieldPalette = this.page.getByRole('region', { name: 'Field palette' });
  readonly fieldSearch = this.fieldPalette.getByRole('searchbox', { name: 'Search fields' });
  readonly pagesRegion = this.page.getByRole('region', { name: 'Pages' });
  readonly inspector = this.page.getByRole('button', { name: 'Hide Inspector' });

  fieldTile(name: string) {
    return this.fieldPalette.getByRole('button', { name: new RegExp(`^Place ${name}`) });
  }

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(
      this.page.getByRole('heading', { name: 'New envelope', exact: true }),
    ).toBeVisible();
  }

  async openDraft(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
  }

  /**
   * Opens the newest existing draft from the "New envelope" landing page.
   * Builder tests use this instead of uploading, so a run never spends the
   * workspace's monthly signature-request quota.
   */
  async continueLatestDraft(): Promise<void> {
    const link = this.page.getByRole('link', { name: /Continue your most recent draft/ });
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(this.page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/);
    await expect(this.heading).toBeVisible();
  }

  async upload(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await expect(this.page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/, { timeout: 30_000 });
    await expect(this.heading).toBeVisible();
  }

  async placeFieldInMiddle(name: string): Promise<void> {
    await this.fieldTile(name).focus();
    await this.fieldTile(name).press('Enter');
  }

  async goToWorkflow(): Promise<void> {
    await this.workflowButton.click();
    await expect(this.page).toHaveURL(/\/workflow/);
  }

  documentIdFromUrl(): string {
    const match = this.page.url().match(/\/documents\/([0-9a-f-]+)\//);
    if (!match) throw new Error(`No document id in URL: ${this.page.url()}`);
    return match[1];
  }
}
