import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';
import { ensureContact } from '../../src/helpers/contacts';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

/**
 * CON-008 / UF-33 — "Add as recipient" from a contact. Runs in `chromium-builder`: the
 * action writes to the newest draft, so it must not race the builder specs, and every
 * recipient it adds is removed again.
 */
type Recipient = { id: string; role_name: string; contact_id: string | null };

const liveDocIds = async (page: Page): Promise<string[]> => {
  const body = await (await page.request.get(API.documents)).json();
  const docs: { id: string; is_template: boolean; deleted_at: string | null }[] = Array.isArray(body) ? body : body.items ?? body.data;
  return docs.filter((d) => !d.is_template && !d.deleted_at).map((d) => d.id);
};
const recipientsOf = async (page: Page, id: string): Promise<Recipient[]> =>
  (await page.request.get(`${API.document(id)}/recipients`)).json();

/** Removes every recipient linked to `contactId` from every draft, through the builder UI. */
async function removeContactFromDrafts(page: Page, contactId: string) {
  for (const docId of await liveDocIds(page)) {
    for (const r of (await recipientsOf(page, docId)).filter((x) => x.contact_id === contactId)) {
      await page.goto(`/documents/${docId}/prepare`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      const dialog = page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
      await clickUntilVisible(page.getByRole('region', { name: 'Recipients' }).getByRole('button', { name: 'Manage recipients' }), dialog, { timeout: 60_000 });
      await dialog.getByRole('button', { name: `Remove ${r.role_name}`, exact: true }).click();
      await page.getByRole('dialog', { name: /^Remove / }).getByRole('button', { name: 'Remove', exact: true }).click();
      await dialog.getByRole('button', { name: 'Save and Continue' }).click();
      await expect.poll(async () => (await recipientsOf(page, docId)).some((x) => x.id === r.id), { message: `recipient ${r.role_name} was not removed`, timeout: 20_000 }).toBe(false);
    }
  }
}

test.describe('Contacts · add as recipient @data', () => {
  test('BUG-31 CON-008 "Add as recipient" lets the user see which envelope the contact joins', knownBug(KNOWN_BUGS.BUG31, ['@data']), async ({ contactsPage, page }) => {
    expectOpenBugsToFail();
    const id = await ensureContact(page, contactsPage, { fullName: 'QA Contact (recipient check)', email: 'qa.contact.recipient-check@example.com', jobTitle: 'QA Recipient' });
    try {
      await page.goto(`/contacts/${id}`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      const url = page.url();
      await page.getByRole('button', { name: 'Add as recipient' }).click();
      /* The (≈2 s) notice confirms the add… */
      const notice = page.getByRole('status').filter({ hasText: /added as recipient/ });
      await expect(notice).toBeVisible({ timeout: 10_000 });
      const text = await notice.innerText();
      /* …but the user must also learn WHICH envelope: a picker, navigation to it, or its name/ENV id in the notice. */
      const named = /ENV-[0-9A-F]{8}|sample-agreement|envelope “|envelope "/i.test(text);
      expect(named || page.url() !== url || (await page.getByRole('dialog').count()) > 0,
        `"Add as recipient" did not say which envelope it changed (notice: "${text}")`).toBe(true);
    } finally {
      await removeContactFromDrafts(page, id);
    }
  });
});
