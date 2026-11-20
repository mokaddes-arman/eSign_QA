import { test, expect } from '../../src/fixtures/test';
import { ensureContact, listContacts } from '../../src/helpers/contacts';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

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

  test('CON-007 edits to a contact persist after reload @flow @data', async ({ contactsPage, page }) => {
    const id = await ensureContact(page, contactsPage, { fullName: 'QA Contact (edit check)', email: 'qa.contact.edit-check@example.com', company: 'QA Flow Ltd' });
    const title = `QA Edit ${Date.now()}`;
    await page.goto(`/contacts/${id}`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    const jobTitle = page.getByRole('textbox', { name: 'Job title' });
    await clickUntilVisible(page.getByRole('button', { name: 'Edit contact' }), jobTitle);
    await jobTitle.fill(title);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(jobTitle).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tabpanel', { name: 'Contact details' })).toContainText(title, { timeout: 20_000 });
    await expect.poll(async () => (await listContacts(page)).find((c) => c.id === id)?.title).toBe(title);
  });

  test('SEC-025 a script-like contact name is shown as text and never runs @security @data', async ({ contactsPage, page }) => {
    const name = 'QA <img src=x onerror="window.__xss=1"> XSS';
    const id = await ensureContact(page, contactsPage, { fullName: name, email: 'qa.contact.xss-check@example.com' });
    page.on('dialog', (d) => { throw new Error(`script ran: dialog "${d.message()}"`); });
    for (const url of ['/contacts', `/contacts/${id}`]) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      await expect(page.getByText(name, { exact: true }).first(), `${url} does not show the name as text`).toBeVisible({ timeout: 20_000 });
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), `payload executed on ${url}`).toBeUndefined();
      expect(await page.locator('main img[src="x"]').count(), `payload rendered as an <img> on ${url}`).toBe(0);
    }
  });
});
