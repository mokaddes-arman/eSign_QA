import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';
import { textsIn } from '../../src/helpers/ui';
import { API } from '../../src/helpers/api';
import { requireData } from '../../src/helpers/precondition';
import { waitForHydration } from '../../src/helpers/wait';

type ApiRow = {
  id: string; name: string; email: string; company: string | null; title: string | null; group: string;
  source: string; envelope_count: number; last_signed_at: string | null; owner_name: string;
};

test.describe('Contacts address book', () => {
  test.beforeEach(async ({ contactsPage }) => {
    await contactsPage.goto();
  });

  test('CON-001 renders the address book columns with each contact’s data @smoke', async ({ contactsPage, page }) => {
    await expect(contactsPage.heading).toBeVisible();
    await expect(contactsPage.addressBookHeading).toBeVisible();
    const columns = ['Contact', 'Company', 'Group', 'Source', 'Last signed', 'Envelopes'];
    await expect(page.getByRole('row').first().getByRole('columnheader')).toHaveText(columns);

    /* Every contact on the page is shown with its own values in the right column. */
    const body = (await (await page.request.get(API.contacts)).json()) as { items: ApiRow[]; total?: number };
    const items = body.items;
    requireData(items.length > 0, 'the address book has no contacts (API)');
    const rows = page.getByRole('row').filter({ has: page.getByRole('cell') });
    const shown = await rows.count();
    await expect(contactsPage.addressBookHeading).toHaveText(`Address book (${shown} of ${body.total ?? items.length})`);
    for (const contact of items.slice(0, shown)) {
      const row = rows.filter({ has: page.getByRole('link', { name: contact.name, exact: true }) }).filter({ hasText: contact.email });
      await expect(row, `no row for ${contact.email}`).toHaveCount(1);
      const cells = await textsIn(row, 'td');
      expect(cells[0]).toContain(contact.email);
      expect(cells[1], `${contact.email} company and title`).toBe(contact.company ? [contact.company, contact.title].filter(Boolean).join(' ') : '—');
      expect(cells[2].toLowerCase(), `${contact.email} group`).toBe(contact.group.toLowerCase());
      expect(cells[3].toLowerCase(), `${contact.email} source`).toBe(contact.source.toLowerCase());
      if (!contact.last_signed_at) expect(cells[4], `${contact.email} last signed`).toBe('—');
      expect(cells[5], `${contact.email} envelopes`).toBe(`${contact.envelope_count} envelope${contact.envelope_count === 1 ? '' : 's'}`);
    }
  });

  test('CON-006 contact page tabs show the contact’s details and envelopes', async ({ page }) => {
    const { items } = (await (await page.request.get(API.contacts)).json()) as { items: ApiRow[] };
    /* Prefer the fixed record the flows maintain; any contact with a company will do. */
    const contact = items.find((c) => c.name === 'QA Contact (edit check)') ?? items.find((c) => c.company);
    requireData(contact, 'no contact with a company in the address book (API)');
    await page.goto(`/contacts/${contact.id}`);
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 2, name: contact.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send envelope' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add as recipient' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Contact sections' });
    await expect(tabs.getByRole('tab')).toHaveText(['Documents', 'Contact details']);

    const details = page.getByRole('tabpanel', { name: 'Contact details' });
    await expect(tabs.getByRole('tab', { name: 'Contact details' })).toHaveAttribute('aria-selected', 'true');
    const terms = await details.locator('dt').allInnerTexts();
    const values = await details.locator('dd').allInnerTexts();
    const value = (term: string) => values[terms.indexOf(term)]?.trim();
    expect(value('Email')).toBe(contact.email);
    expect(value('Company')).toBe(contact.company ?? 'Not set');
    expect(value('Job title')).toBe(contact.title ?? 'Not set');
    expect(value('Group')?.toLowerCase()).toBe(contact.group.toLowerCase());
    expect(value('Source')?.toLowerCase()).toBe(contact.source.toLowerCase());
    expect(value('Owner')).toBe(contact.owner_name);
    expect(value('Envelopes')).toBe(String(contact.envelope_count));
    await expect(details.getByRole('button', { name: 'Edit contact' })).toBeVisible();

    await tabs.getByRole('tab', { name: 'Documents' }).click();
    await expect(tabs.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
    const documents = page.getByRole('tabpanel', { name: 'Documents' });
    await expect(documents.getByRole('heading', { name: `Envelopes with ${contact.name}` })).toBeVisible();
    await expect(details).toBeHidden();
    const envelopeRows = documents.getByRole('row').filter({ has: page.getByRole('cell') });
    if (contact.envelope_count === 0) await expect(documents.getByText('No envelopes involving this contact yet.')).toBeVisible();
    else await expect(envelopeRows).toHaveCount(contact.envelope_count);

    await tabs.getByRole('tab', { name: 'Contact details' }).click();
    await expect(details).toBeVisible();
  });

  test('opens the new-contact form with all fields @smoke', async ({ contactsPage }) => {
    await contactsPage.openNewContact();

    await expect(contactsPage.fullNameInput).toBeVisible();
    await expect(contactsPage.emailInput).toBeVisible();
    await expect(contactsPage.companyInput).toBeVisible();
    await expect(contactsPage.jobTitleInput).toBeVisible();
    await expect(contactsPage.roleSelect).toBeVisible();
    await expect(contactsPage.groupSelect).toBeVisible();

    const roles = await optionLabels(contactsPage.roleSelect);
    expect(roles).toEqual(
      expect.arrayContaining(['Needs to sign', 'Approver', 'Receives a copy', 'In-person signer']),
    );

    await contactsPage.cancelButton.click();
    await expect(contactsPage.dialog).toBeHidden();
  });

  test('creates a contact and lists it in the address book @data', async ({ contactsPage }) => {
    const stamp = Date.now();
    const name = `QA Contact ${stamp}`;
    const email = `qa.contact.${stamp}@example.com`;

    await contactsPage.createContact({
      fullName: name,
      company: 'Global Softel',
      email,
      jobTitle: 'QA Engineer',
      role: 'Needs to sign',
      group: 'Customers',
    });

    /* Saving opens the new contact's detail sheet. */
    await expect(contactsPage.page).toHaveURL(/\/contacts\/[0-9a-z-]+/i, { timeout: 10_000 });
    await expect(
      contactsPage.page.getByRole('heading', { name, level: 2 }),
    ).toBeVisible();
    await expect(contactsPage.page.getByRole('link', { name: email })).toBeVisible();
  });

  test('rejects invalid email on save @regression', async ({ contactsPage }) => {
    await contactsPage.openNewContact();
    await contactsPage.fullNameInput.fill('QA Invalid');
    await contactsPage.emailInput.fill('not-an-email');
    await contactsPage.saveButton.click();

    /* Native e-mail validation blocks the save: the field is invalid and the dialog stays. */
    expect(await contactsPage.emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    await expect(contactsPage.dialog).toBeVisible();
    await contactsPage.cancelButton.click();
    await expect(contactsPage.dialog).toBeHidden();
  });
});
