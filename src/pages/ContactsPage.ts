import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type ContactGroup = 'Customers' | 'Internal' | 'Counsel' | 'Vendors';
export type RecipientRole = 'Needs to sign' | 'Approver' | 'Receives a copy' | 'In-person signer';

export interface ContactInput {
  fullName: string;
  company?: string;
  email: string;
  jobTitle?: string;
  role?: RecipientRole;
  group?: ContactGroup;
}

export class ContactsPage extends BasePage {
  protected readonly path = '/contacts';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Contacts' });
  readonly addressBookHeading = this.page.getByRole('heading', { name: /Address book/ });
  readonly newContactButton = this.page.getByRole('button', { name: 'New contact' });
  readonly emptyState = this.page.getByText('No contacts yet');
  readonly table = this.page.getByRole('table');

  readonly dialog = this.page.getByRole('dialog');
  readonly fullNameInput = this.dialog.getByRole('textbox', { name: 'Full name' });
  readonly companyInput = this.dialog.getByRole('textbox', { name: 'Company' });
  readonly emailInput = this.dialog.getByRole('textbox', { name: 'Email' });
  readonly jobTitleInput = this.dialog.getByRole('textbox', { name: 'Job title' });
  readonly roleSelect = this.dialog.getByLabel('Default role');
  readonly groupSelect = this.dialog.getByLabel('Group');
  readonly saveButton = this.dialog.getByRole('button', { name: 'Save contact' });
  readonly cancelButton = this.dialog.getByRole('button', { name: 'Cancel' });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openNewContact(): Promise<void> {
    await this.newContactButton.click();
    await expect(this.dialog).toBeVisible();
  }

  async createContact(contact: ContactInput): Promise<void> {
    await this.openNewContact();
    await this.fullNameInput.fill(contact.fullName);
    if (contact.company) await this.companyInput.fill(contact.company);
    await this.emailInput.fill(contact.email);
    if (contact.jobTitle) await this.jobTitleInput.fill(contact.jobTitle);
    if (contact.role) await this.roleSelect.selectOption({ label: contact.role });
    if (contact.group) await this.groupSelect.selectOption({ label: contact.group });
    await this.saveButton.click();
    await expect(this.dialog).toBeHidden();
  }

  async searchContact(term: string): Promise<void> {
    await this.page.getByRole('searchbox', { name: /search documents, templates, contacts/i }).first().fill(term);
    await this.page.keyboard.press('Enter');
  }

  contactRow(name: string) {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') });
  }
}
