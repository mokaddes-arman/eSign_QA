import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** /documents/{id}/workflow — routing, reminders, branding and send step. */
export class WorkflowPage extends BasePage {
  protected path = '/documents';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Workflow & routing' });
  readonly sequentialButton = this.page.getByRole('button', { name: 'Sequential' });
  readonly parallelButton = this.page.getByRole('button', { name: 'Parallel' });
  readonly addRecipientButton = this.page.getByRole('button', { name: 'Add recipient' });
  readonly sendEnvelopeButton = this.page.getByRole('button', { name: 'Send envelope' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });
  readonly saveButton = this.page.getByRole('button', { name: 'Save', exact: true });

  readonly subjectInput = this.page.getByLabel('Subject');
  readonly messageInput = this.page.getByLabel(/^Message/);
  readonly invitePreview = this.page.getByRole('heading', { name: 'Invite preview' });
  readonly beforeYouSend = this.page.getByRole('heading', { name: 'Before you send' });
  readonly reminders = this.page.getByRole('heading', { name: 'Reminders & expiration' });
  readonly branding = this.page.getByRole('heading', { name: 'Branding' });
  readonly deliverySimulation = this.page.getByRole('heading', { name: 'Delivery simulation' });

  recipientEmail(index: number) {
    return this.page.getByLabel(new RegExp(`Recipient ${index} email`, 'i'));
  }

  recipientName(index: number) {
    return this.page.getByLabel(new RegExp(`Recipient ${index} name`, 'i'));
  }

  recipientRole(index: number) {
    return this.page.getByLabel('Role').nth(index - 1);
  }

  async openFor(documentId: string): Promise<void> {
    await this.page.goto(`/documents/${documentId}/workflow`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.heading).toBeVisible();
  }
}
