import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** /documents/{id}/workflow — routing, reminders, branding and send step. */
export class WorkflowPage extends BasePage {
  protected path = '/documents';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Workflow & routing' });
  readonly sequentialButton = this.healButton('Sequential', false);
  readonly parallelButton = this.healButton('Parallel', false);
  readonly addRecipientButton = this.healButton('Add recipient', false);
  readonly sendEnvelopeButton = this.healButton('Send envelope', false);
  readonly backButton = this.healButton('Back', false);
  readonly saveButton = this.healButton('Save');

  readonly subjectInput = this.page.getByLabel('Subject');
  readonly messageInput = this.page.getByLabel(/^Message/);
  readonly invitePreview = this.page.getByRole('heading', { name: 'Invite preview' });
  readonly beforeYouSend = this.page.getByRole('heading', { name: 'Before you send' });
  readonly reminders = this.page.getByRole('heading', { name: 'Reminders & expiration' });
  readonly branding = this.page.getByRole('heading', { name: 'Branding' });
  readonly deliverySimulation = this.page.getByRole('heading', { name: 'Delivery simulation' });

  readonly recipientsRegion = this.page.getByRole('region', { name: 'Recipients & signing order' });
  readonly beforeYouSendRegion = this.page.getByRole('region', { name: 'Before you send' });
  readonly invitePreviewGroup = this.page.getByRole('group', { name: 'Invitation email preview' });
  readonly reminderCadence = this.page.getByRole('group', { name: 'Reminder cadence' });
  readonly expiresSelect = this.page.getByRole('combobox', { name: 'Expires' });
  readonly openBuilderLink = this.page.getByRole('link', { name: 'Open builder' });
  readonly prepareStepButton = this.page.getByRole('group', { name: 'Steps' }).getByRole('button', { name: 'Prepare' });

  /** Checklist row about recipient e-mails ("Recipients need an email …"). */
  readonly recipientEmailCheck = this.beforeYouSendRegion
    .getByRole('listitem')
    .filter({ hasText: /recipient/i })
    .first();

  /** Inline field error shown under a recipient e-mail (`.env-field-error`). */
  readonly recipientFieldError = this.recipientsRegion.locator('.env-field-error, [id][role="alert"]').first();

  saveRecipientEmailButton(index: number) {
    return this.page.getByRole('button', { name: `Save Recipient ${index} email` });
  }

  recipientEmail(index: number) {
    return this.page.getByRole('combobox', { name: new RegExp(`^Recipient ${index} email$`, 'i') });
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
