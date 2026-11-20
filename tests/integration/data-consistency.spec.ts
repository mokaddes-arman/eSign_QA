import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { API } from '../../src/helpers/api';

/*
 * Integration: what the UI shows must agree with what the backend returns.
 * Each test reads the API through the same session and compares it with the
 * rendered page. Read-only. Case ids INT-001…INT-006 (docs/TEST_CASES.md §17).
 */
type Doc = { is_template: boolean; archived_at: string | null; deleted_at: string | null; title: string };

const active = (docs: Doc[]) => docs.filter((d) => !d.is_template && !d.archived_at && !d.deleted_at);

test.describe('Integration · UI ↔ API consistency', () => {
  test('INT-001 library document count matches the documents API @smoke', async ({ documentsPage, request }) => {
    const docs: Doc[] = await (await request.get(API.documents)).json();
    const expected = active(docs).length;

    await documentsPage.goto();
    const region = documentsPage.page.getByRole('region', { name: 'Documents' });
    await expect(region.getByText(/^\d+ documents?$/)).toHaveText(new RegExp(`^${expected} documents?$`));
    await expect(documentsPage.page.getByRole('link', { name: new RegExp(`^All documents ${expected}$`) })).toBeVisible();
    await expect(documentsPage.rows).toHaveCount(expected);
  });

  test('INT-002 every API document title appears in the library', async ({ documentsPage, request }) => {
    const docs = active(await (await request.get(API.documents)).json());
    requireData(docs.length > 0, 'the workspace has no documents (API)');
    await documentsPage.goto();
    const listed = await documentsPage.rows.allInnerTexts();
    for (const title of new Set(docs.map((d) => d.title))) {
      const expected = docs.filter((d) => d.title === title).length;
      const actual = listed.filter((row) => row.includes(title)).length;
      expect(actual, `rows titled "${title}"`).toBe(expected);
    }
  });

  test('INT-003 address-book counts match the contacts API', async ({ contactsPage, request }) => {
    /* Other tests (@data) may add contacts meanwhile: re-read the API and reload the page
       until both describe the same snapshot, then compare every figure. */
    await expect(async () => {
      const body = await (await request.get(API.contacts)).json();
      await contactsPage.goto();
      await expect(contactsPage.page.getByRole('heading', { name: `Address book (${body.total} of ${body.total})` })).toBeVisible({ timeout: 5_000 });
      await expect(contactsPage.page.getByRole('button', { name: `All ${body.total}`, exact: true })).toBeVisible({ timeout: 5_000 });
      for (const group of ['Customers', 'Internal', 'Counsel', 'Vendors']) {
        const n = body.items.filter((c: { group?: string }) => String(c.group).toLowerCase() === group.toLowerCase()).length;
        await expect(contactsPage.page.getByRole('button', { name: `${group} ${n}`, exact: true }), `${group} chip shows ${n}`).toBeVisible({ timeout: 5_000 });
      }
    }, 'Address-book counts never matched the contacts API').toPass({ timeout: 60_000 });
  });

  test('INT-004 plan-usage widget percentage matches billing usage', async ({ overviewPage, navigation, request }) => {
    const usage = await (await request.get(API.billingUsage)).json();
    const { limit, used } = usage.limits.max_documents_per_month;
    const percent = Math.round((used / limit) * 100);

    await overviewPage.goto();
    await navigation.open();
    await expect(navigation.planUsageLink).toContainText(`${percent}%`);
  });

  test('INT-006 profile page shows the API user record', async ({ profilePage, request }) => {
    const me = await (await request.get(API.me)).json();
    await profilePage.goto();
    await expect(profilePage.fullNameInput).toHaveValue(me.name);
    await expect(profilePage.emailInput).toHaveValue(me.email);
  });
});
