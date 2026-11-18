import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { clickUntilVisible } from '../helpers/wait';

export type TicketCategory =
  | 'Signing issue'
  | 'Document preparation'
  | 'API / integration'
  | 'Billing & invoices'
  | 'Security & compliance';
export type TicketPriority = 'P1 · Urgent — signing blocked' | 'P2 · High' | 'P3 · Normal' | 'P4 · Low';

export class SupportPage extends BasePage {
  protected readonly path = '/support';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Support' });
  readonly openTicketsStat = this.page.getByText('Your open tickets');
  readonly newTicketButton = this.healButton('New ticket', false);
  readonly emptyState = this.page.getByText('You have no support tickets yet.');
  readonly table = this.page.getByRole('table');
  readonly statusFilter = this.page.getByLabel('Filter by status');
  readonly priorityFilter = this.page.getByLabel('Filter by priority');
  readonly sortFilter = this.page.getByLabel('Sort tickets');

  readonly dialog = this.page.getByRole('dialog');
  readonly subjectInput = this.dialog.getByRole('textbox', { name: 'Subject' });
  readonly categorySelect = this.dialog.getByLabel('Category');
  readonly prioritySelect = this.dialog.getByLabel('Priority');
  readonly relatedEnvelopeInput = this.dialog.getByRole('textbox', { name: /Related envelope/ });
  readonly descriptionInput = this.dialog.getByRole('textbox', { name: 'Description' });
  readonly submitButton = this.dialog.getByRole('button', { name: 'Submit ticket' });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openNewTicket(): Promise<void> {
    await clickUntilVisible(this.newTicketButton, this.dialog, { what: "The New ticket dialog did not open" });
  }

  async fillTicket(input: {
    subject: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    description: string;
  }): Promise<void> {
    await this.subjectInput.fill(input.subject);
    if (input.category) await this.categorySelect.selectOption({ label: input.category });
    if (input.priority) await this.prioritySelect.selectOption({ label: input.priority });
    await this.descriptionInput.fill(input.description);
  }

  ticketRow(subject: string) {
    return this.page.getByRole('row', { name: new RegExp(subject, 'i') });
  }
}
