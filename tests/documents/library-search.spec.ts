import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import type { Page } from '@playwright/test';
import type { DocumentsPage } from '../../src/pages/DocumentsPage';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/*
 * Library search, status filter, sort and empty state — behaviour, not presence:
 * every check compares the rows shown with the documents API. Read-only.
 * Cases DOC-004, DOC-006, DOC-015, DOC-023.
 */
type Doc = { id: string; title: string; status: string; updated_at: string; is_template: boolean; archived_at: string | null; deleted_at: string | null };
const envId = (doc: Doc) => `ENV-${doc.id.slice(0, 8).toUpperCase()}`;

/** Types into library search and waits until the query is committed (`?q=`); text typed before hydration is dropped (R3). */
async function search(page: Page, documentsPage: DocumentsPage, term: string): Promise<void> {
  await expect(async () => {
    /* Re-filling an identical value fires no change event, so clear first. */
    if (term) await documentsPage.searchInput.fill('');
    await documentsPage.searchInput.fill(term);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q') ?? '', { timeout: 3_000 })
      .toBe(term);
  }).toPass({ timeout: 20_000 });
}

test.describe('Documents · search, filter & sort', () => {
  let docs: Doc[] = [];

  test.beforeEach(async ({ request, documentsPage }) => {
    docs = ((await (await request.get(API.documents)).json()) as Doc[]).filter((d) => !d.is_template && !d.archived_at && !d.deleted_at);
    await documentsPage.goto();
  });

  test('DOC-023 search by envelope id returns exactly that document @regression', async ({ documentsPage, page }) => {
    requireData(docs.length > 0, 'the workspace has no documents (API)');
    const target = docs[0];
    await search(page, documentsPage, envId(target));
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(documentsPage.rows).toHaveCount(1);
    await expect(documentsPage.rows.first()).toContainText(envId(target));
  });

  test('DOC-023 search by title returns every document with that title', async ({ documentsPage, page }) => {
    requireData(docs.length > 0, 'the workspace has no documents (API)');
    const title = docs[0].title;
    const expected = docs.filter((d) => d.title.toLowerCase().includes(title.toLowerCase())).length;
    await search(page, documentsPage, title);
    await expect(documentsPage.rows).toHaveCount(expected);
    for (const row of await documentsPage.rows.all()) await expect(row).toContainText(title);
  });

  test('DOC-015 no-match search shows the empty state and clearing restores the list @regression', async ({ documentsPage, page }) => {
    await search(page, documentsPage, `zz-no-match-${Date.now()}`);
    const region = page.getByRole('region', { name: 'Documents' });
    await expect(region.getByText(/^0 documents$/)).toBeVisible();
    await expect(documentsPage.rows).toHaveCount(0);
    await expect(page.getByText('Nothing in Documents')).toBeVisible();
    await expect(page.getByText(/clear the filters/i)).toBeVisible();

    await search(page, documentsPage, '');
    await expect(documentsPage.rows).toHaveCount(docs.length);
  });

  /**
   * Filters and views are applied by a server round-trip (`?status=` / `?folder=`):
   * the old rows stay on screen until it completes, so wait for the URL to change,
   * then read the server-rendered "N documents" count — never count stale rows.
   */
  async function shownCount(page: Page): Promise<number> {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    /* The list region is named after the active folder/view ("Documents", "Drafts", …). */
    const text = await page.getByRole('main').getByText(/^\d+ documents?$/).first().innerText();
    return Number(text.split(' ')[0]);
  }

  async function applyStatus(page: Page, documentsPage: DocumentsPage, label: string): Promise<number> {
    const before = page.url();
    await expect(async () => {
      await documentsPage.statusFilter.selectOption({ label });
      await expect(page).not.toHaveURL(before, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    return shownCount(page);
  }

  test('DOC-004 status filter narrows the list to matching envelopes', async ({ documentsPage, page }) => {
    await documentsPage.openFilters();
    expect(await applyStatus(page, documentsPage, 'Completed')).toBe(docs.filter((d) => d.status === 'completed').length);
    expect(await applyStatus(page, documentsPage, 'Voided')).toBe(docs.filter((d) => d.status === 'voided').length);
    expect(await applyStatus(page, documentsPage, 'All statuses')).toBe(docs.length);
    await expect(documentsPage.rows).toHaveCount(docs.length);
  });

  test('DOC-005 type, time and owner filters narrow the list to the matching envelopes', async ({ documentsPage, page, request }) => {
    const me = await (await request.get(API.me)).json();
    const full = (await (await request.get(API.documents)).json()) as (Doc & { doc_type: string | null; owner_user_id: string; created_at: string })[];
    const live = full.filter((d) => !d.is_template && !d.archived_at && !d.deleted_at);
    const apply = async (select: import('@playwright/test').Locator, label: string) => {
      const before = page.url();
      await expect(async () => {
        await select.selectOption({ label });
        await expect(page).not.toHaveURL(before, { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      return shownCount(page);
    };
    await documentsPage.openFilters();

    /* Time: "Last 7 days" keeps envelopes updated in the last 7 days (the builder draft is edited every run). */
    const week = live.filter((d) => Date.now() - Date.parse(d.updated_at) <= 7 * 24 * 3600 * 1000).length;
    requireData(week > 0 && week < live.length, `the time filter needs both recent and older envelopes (${week} of ${live.length} updated this week)`);
    expect(await apply(documentsPage.timeFilter, 'Last 7 days'), 'Last 7 days vs updated_at (API)').toBe(week);
    await expect(page).toHaveURL(/[?&]time=7\b/);
    expect(await apply(documentsPage.timeFilter, 'All time')).toBe(live.length);

    /* Owner: "Owned by me" keeps the signed-in user's envelopes. */
    expect(await apply(documentsPage.ownerFilter, 'Owned by me'), 'Owned by me vs owner (API)').toBe(live.filter((d) => d.owner_user_id === me.id).length);
    expect(await apply(documentsPage.ownerFilter, 'All owners')).toBe(live.length);

    /* Type: each document type keeps only envelopes of that type (none are typed yet → empty state). */
    const agreements = live.filter((d) => d.doc_type === 'agreement').length;
    expect(await apply(documentsPage.typeFilter, 'Agreements'), 'Agreements vs doc_type (API)').toBe(agreements);
    if (agreements === 0) await expect(page.getByRole('main').getByText(/^Nothing in /)).toBeVisible();
    expect(await apply(documentsPage.typeFilter, 'All types')).toBe(live.length);
  });

  test('DOC-004 BUG-23 status filter "Drafts" lists the same envelopes as the Drafts view', knownBug(KNOWN_BUGS.BUG23), async ({ documentsPage, page }) => {
    expectOpenBugsToFail();
    await documentsPage.openFolder('Drafts');
    await expect(page).toHaveURL(/folder=drafts/);
    const inDraftsView = await shownCount(page);
    requireData(docs.some((d) => ['draft', 'prepared'].includes(d.status)), 'the workspace has no drafts (API)');

    await documentsPage.goto();
    await documentsPage.openFilters();
    const filtered = await applyStatus(page, documentsPage, 'Drafts');
    expect(page.url()).toMatch(/status=draft/);
    expect(filtered, `Drafts view lists ${inDraftsView}; the Drafts status filter shows ${filtered}`).toBe(inDraftsView);
  });

  test('DOC-002 Drafts and Completed views list the matching envelopes', async ({ documentsPage, page }) => {
    await documentsPage.openFolder('Drafts');
    await expect(page).toHaveURL(/folder=drafts/);
    expect(await shownCount(page)).toBe(docs.filter((d) => ['draft', 'prepared'].includes(d.status)).length);

    await documentsPage.openFolder('Completed');
    await expect(page).toHaveURL(/folder=completed/);
    expect(await shownCount(page)).toBe(docs.filter((d) => d.status === 'completed').length);
    await expect(documentsPage.rows).toHaveCount(docs.filter((d) => d.status === 'completed').length);
  });

  test('DOC-006 "Recent" sort lists the most recently updated envelope first', async ({ documentsPage, page }) => {
    requireData(docs.length >= 2, 'sorting needs at least two documents (API)');
    const expected = [...docs].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).map(envId);
    const shown = (await documentsPage.rows.allInnerTexts()).map((t) => /ENV-[0-9A-F]{8}/.exec(t)?.[0]);
    expect(shown).toEqual(expected);
  });

  test('DOC-006 "Name" sort orders titles alphabetically', async ({ documentsPage, page }) => {
    requireData(docs.length >= 2, 'sorting needs at least two documents (API)');
    await documentsPage.selectSort('Name');
    const titles = await documentsPage.rows.evaluateAll((rows) =>
      rows.map((r) => (r.querySelector('button:not([aria-label])')?.textContent ?? '').trim().toLowerCase()),
    );
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });
});
