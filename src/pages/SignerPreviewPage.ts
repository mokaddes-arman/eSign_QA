import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignerPreviewPage extends BasePage {
  protected path = '/documents';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Signer experience' });
  readonly desktopToggle = this.page.getByRole('button', { name: 'Desktop' });
  readonly mobileToggle = this.page.getByRole('button', { name: 'Mobile' });
  readonly startSigningButton = this.page.getByRole('button', { name: 'Start signing' });
  readonly disclosureButton = this.page.getByRole('button', { name: 'Disclosure' });
  readonly declineButton = this.page.getByRole('button', { name: 'Decline' });
  readonly reassignButton = this.page.getByRole('button', { name: 'Reassign' });
  readonly finishButton = this.page.getByRole('button', { name: 'Finish' });
  readonly downloadUnsignedButton = this.page.getByRole('button', { name: 'Download unsigned PDF' });
  readonly previewNotice = this.page.getByText(/Preview only\. Anything you fill in here is not saved/);

  async openFor(documentId: string, recipientId: string): Promise<void> {
    await this.page.goto(
      `/documents/${documentId}/signer-view?recipient=${recipientId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(this.heading).toBeVisible();
  }
}
