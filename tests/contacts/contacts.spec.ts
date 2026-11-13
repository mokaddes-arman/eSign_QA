import { test, expect } from '../../src/fixtures/test';

test.describe('Contacts address book', () => {
  test.beforeEach(async ({ contactsPage }) => {
    await contactsPage.goto();
  });

  test('renders the address book columns @smoke', async ({ contactsPage }) => {
    await expect(contactsPage.heading).toBeVisible();
    await expect(contactsPage.addressBookHeading).toBeVisible();

    for (const column of ['Contact', 'Company', 'Group', 'Source', 'Last signed', 'Envelopes']) {
      await expect(contactsPage.page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('opens the new-contact form with all fields @smoke', async ({ contactsPage }) => {
    await contactsPage.openNewContact();

    await expect(contactsPage.fullNameInput).toBeVisible();
    await expect(contactsPage.emailInput).toBeVisible();
    await expect(contactsPage.companyInput).toBeVisible();
    await expect(contactsPage.jobTitleInput).toBeVisible();
    await expect(contactsPage.roleSelect).toBeVisible();
    await expect(contactsPage.groupSelect).toBeVisible();

    const roles = await contactsPage.roleSelect.locator('option').allTextContents();
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
    await expect(contactsPage.dialog).toBeVisible();
    await contactsPage.cancelButton.click();
  });
});
