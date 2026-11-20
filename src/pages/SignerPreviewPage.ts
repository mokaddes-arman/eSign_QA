import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignerPreviewPage extends BasePage {
  protected path = '/documents';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Signer experience' });
  readonly desktopToggle = this.healButton('Desktop', false);
  readonly mobileToggle = this.healButton('Mobile', false);
  readonly startSigningButton = this.healButton('Start signing', false);
  readonly disclosureButton = this.healButton('Disclosure', false);
  readonly declineButton = this.healButton('Decline', false);
  readonly reassignButton = this.healButton('Reassign', false);
  readonly finishButton = this.healButton('Finish', false);
  readonly downloadUnsignedButton = this.healButton('Download unsigned PDF', false);
  readonly previewNotice = this.page.getByText(/Preview only\. Anything you fill in here is not saved/);
  readonly backToEditingLink = this.page.getByRole('link', { name: 'Back to editing' });
  readonly progress = this.page.getByRole('progressbar', { name: 'Required fields completed' });
  /** Fields the previewed recipient has to complete ("Signature — Signature (required)"). */
  readonly signerFields = this.page.getByRole('button', { name: / — .+ \((required|optional)\)/ });

  /**
   * "PREVIEW AS" switcher: one link per recipient ("Recipient 1 6 fields"),
   * each pointing at `signer-view?recipient=<id>`.
   */
  readonly previewAsLinks = this.page.locator('main a[href*="signer-view?recipient="]');

  /** A combined "everyone" preview, which BUG-03 says is missing. */
  readonly allRecipientsOption = this.page
    .getByRole('link', { name: /all recipients|everyone/i })
    .or(this.page.getByRole('button', { name: /all recipients|everyone/i }))
    .or(this.page.getByRole('option', { name: /all recipients|everyone/i }));

  async openFor(documentId: string, recipientId: string): Promise<void> {
    await this.page.goto(
      `/documents/${documentId}/signer-view?recipient=${recipientId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(this.heading).toBeVisible();
    await this.waitForDocument();
  }

  /** Waits until the PDF and its fields render; fails with the cause if the PDF did not load (BUG-34). */
  async waitForDocument(): Promise<void> {
    await expect(this.signerFields.first().or(this.page.getByText(/Document request failed/)).first()).toBeVisible({ timeout: 20_000 }).catch(() => undefined);
    await this.assertDocumentAvailable();
  }
}
