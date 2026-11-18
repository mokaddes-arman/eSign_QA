import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { API } from '../../src/helpers/api';

/*
 * Contacts list search and group chips (CON-009, CON-010) — checked against the
 * contacts API. Read-only.
 *
 * The list filters client-side and input typed before hydration is dropped (R3),
 * so each action is retried until the "Address book (N of M)" heading reflects it.
 */
type Contact = { name: string; email: string; company: string | null; group: string | null };

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search contacts' });
const contactLinks = (page: Page) => page.getByRole('region', { name: 'Contacts' }).getByRole('link');
const heading = (page: Page, shown: number, total: number) =>
  page.getByRole('heading', { name: `Address book (${shown} of ${total})` });

async function searchContacts(page: Page, term: string, expectedShown: number, total: number): Promise<void> {
  await expect(async () => {
    /* Re-filling an identical value fires no change event, so clear first. */
    await searchBox(page).fill('');
    await searchBox(page).fill(term);
    await expect(heading(page, expectedShown, total)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe('Contacts · search & group filters', () => {
  let contacts: Contact[] = [];

  test.beforeEach(async ({ request, contactsPage }) => {
    contacts = (await (await request.get(API.contacts)).json()).items;
    await contactsPage.goto();
  });

  test('CON-009 searching by name lists only matching contacts @regression', async ({ page }) => {
    requireData(contacts.length > 0, 'the address book is empty (API)');
    const target = contacts[contacts.length - 1];
    const expected = contacts.filter((c) => c.name.toLowerCase().includes(target.name.toLowerCase())).length;
    await searchContacts(page, target.name, expected, contacts.length);
    await expect(contactLinks(page)).toHaveCount(expected);
    await expect(contactLinks(page).first()).toHaveText(target.name);
  });

  test('CON-009 searching by e-mail finds the contact', async ({ page }) => {
    requireData(contacts.length > 0, 'the address book is empty (API)');
    const target = contacts[0];
    await searchContacts(page, target.email, 1, contacts.length);
    await expect(contactLinks(page)).toHaveCount(1);
    await expect(contactLinks(page).first()).toHaveText(target.name);
  });

  test('CON-009 a search with no match shows an empty state, not an error', async ({ page }) => {
    await searchContacts(page, `zz-no-match-${Date.now()}`, 0, contacts.length);
    await expect(contactLinks(page)).toHaveCount(0);
    await expect(page.getByText('No contacts match')).toBeVisible();
  });

  test('CON-010 group chips filter the table and their counts match the rows', async ({ page }) => {
    const chips = page.getByRole('group', { name: 'Contact groups' });
    for (const group of ['Customers', 'Vendors', 'Internal']) {
      const expected = contacts.filter((c) => String(c.group).toLowerCase() === group.toLowerCase()).length;
      const chip = chips.getByRole('button', { name: new RegExp(`^${group} \\d+$`) });
      await expect(chip).toHaveText(new RegExp(`${group}\\s*${expected}`));
      await expect(async () => {
        if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await expect(contactLinks(page), `${group} rows`).toHaveCount(expected);
    }
    await chips.getByRole('button', { name: /^All \d+$/ }).click();
    await expect(contactLinks(page)).toHaveCount(contacts.length);
  });
});
