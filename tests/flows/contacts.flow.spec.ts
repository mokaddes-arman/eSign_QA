import { test, expect } from '../../src/fixtures/test';

/** UF-32 — build the address book: create a contact, then find it again from anywhere. */
test.describe('Flow · Contacts', () => {
  test('UF-32 sender adds a contact and finds it with global search @flow @data', async ({ contactsPage, page }) => {
    const stamp = Date.now();
    const name = `QA Contact ${stamp}`;
    const email = `qa.contact.${stamp}@example.com`;

    await test.step('create the contact', async () => {
      await contactsPage.goto();
      await contactsPage.createContact({ fullName: name, email, company: 'QA Flow Ltd', role: 'Approver', group: 'Vendors' });
      await expect(page).toHaveURL(/\/contacts\/[0-9a-z-]+/i, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
    });

    await test.step('details show what was entered', async () => {
      await expect(page.getByRole('link', { name: email })).toBeVisible();
      await expect.soft(page.getByText('QA Flow Ltd').first()).toBeVisible();
      await expect.soft(page.getByText('Vendors').first()).toBeVisible();
    });

    await test.step('the contact is listed in the address book', async () => {
      await contactsPage.goto();
      await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
    });

    await test.step('global search finds and opens it', async () => {
      await page.keyboard.press('Control+k');
      const search = page.getByRole('dialog', { name: 'Search your workspace' });
      await search.getByRole('combobox', { name: 'Search' }).fill(String(stamp));
      const hit = search.getByRole('option', { name: new RegExp(name) }).first();
      await expect(hit).toBeVisible({ timeout: 10_000 });
      await hit.click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-z-]+/i);
    });
  });
});
