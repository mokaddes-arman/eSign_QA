import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, UNIQUENESS_FOLDER, bugCheckpoint, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

/**
 * UF-14 / UF-15 — organise the library and use every row action, on a COPY of the newest
 * draft so no real document is touched; the copy is erased (Trash → Delete permanently).
 * Runs in `chromium-account`: a copy briefly becomes the "most recent draft" the builder specs use.
 */
type Doc = { id: string; title: string; folder_id: string | null; archived_at: string | null; deleted_at: string | null; is_template: boolean; created_at: string };
const LIFECYCLE_FOLDER = 'QA Lifecycle folder';

const getDoc = async (page: Page, id: string): Promise<Doc | null> => {
  const res = await page.request.get(API.document(id));
  return res.status() === 404 ? null : res.json();
};
const listDocs = async (page: Page): Promise<Doc[]> => {
  const body = await (await page.request.get(API.documents)).json();
  return Array.isArray(body) ? body : body.items ?? body.data ?? body.documents;
};

/** Opens /documents (or a folder view) and the row menu of the envelope `id`. */
async function openRowMenu(page: Page, view: string, id: string) {
  await page.goto(`/documents${view ? `?folder=${view}` : ''}`, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  const row = page.getByRole('main').getByRole('listitem').filter({ hasText: `ENV-${id.slice(0, 8).toUpperCase()}` });
  await expect(row, `ENV-${id.slice(0, 8)} is not listed in "${view || 'All documents'}"`).toHaveCount(1, { timeout: 20_000 });
  const menu = page.getByRole('menu');
  await clickUntilVisible(row.getByRole('button', { name: 'More actions' }), menu);
  return menu;
}

/** Runs one row-menu action on the envelope `id`, confirming the dialog if `confirm` is given. */
async function rowAction(page: Page, view: string, id: string, item: string | RegExp, confirm?: string) {
  const menu = await openRowMenu(page, view, id);
  await menu.getByRole('menuitem', { name: item, exact: typeof item === 'string' }).first().click();
  if (confirm) await page.getByRole('dialog').getByRole('button', { name: confirm, exact: true }).click();
}

/** Erases a test copy wherever it is: trash it if needed, then Delete permanently. */
async function erase(page: Page, id: string) {
  let doc = await getDoc(page, id);
  if (!doc) return;
  if (!doc.deleted_at) await rowAction(page, doc.archived_at ? 'archive' : '', id, 'Delete', 'Move to Trash');
  await expect.poll(async () => (await getDoc(page, id))?.deleted_at).toBeTruthy();
  await rowAction(page, 'trash', id, 'Delete', 'Delete permanently');
  await expect.poll(() => getDoc(page, id), { message: 'test copy was not erased' }).toBeNull();
}

/** Duplicates the newest draft through the UI and returns the copy's id. */
async function duplicateNewestDraft(page: Page): Promise<string> {
  const live = (await listDocs(page)).filter((d) => !d.is_template && !d.deleted_at && !d.archived_at);
  const source = live.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  test.skip(!source, 'No document to duplicate');
  const before = new Set(live.map((d) => d.id));
  await rowAction(page, '', source.id, 'Duplicate');
  let copy: Doc | undefined;
  await expect.poll(async () => (copy = (await listDocs(page)).find((d) => !before.has(d.id) && d.title === `${source.title} (Copy)`))?.id,
    { message: 'Duplicate did not create "<title> (Copy)"', timeout: 20_000 }).toBeTruthy();
  return copy!.id;
}

test.describe('Flow · Library lifecycle @data', () => {
  test('UF-14 UF-15 DOC-013 DOC-018 copy → rename → move → archive → unarchive → trash @flow', async ({ page, documentsPage }) => {
    const name = `QA Lifecycle ${Date.now()}`;
    let id = '';
    try {
      await test.step('Duplicate creates a copy', async () => {
        id = await duplicateNewestDraft(page);
      });

      await test.step('Rename updates the library and the record', async () => {
        await rowAction(page, '', id, 'Rename');
        const dialog = page.getByRole('dialog', { name: 'Rename document' });
        await dialog.getByRole('textbox', { name: 'Document name' }).fill(name);
        await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect.poll(async () => (await getDoc(page, id))?.title).toBe(name);
        await expect(documentsPage.rowByName(name)).toHaveCount(1);
      });

      await test.step('Move to folder files it in that folder', async () => {
        await documentsPage.goto();
        /* The link name carries the document count once the folder is not empty ("<name> 1"). */
        const folderLink = page.getByRole('navigation', { name: 'Folders' }).getByRole('link', { name: new RegExp(`^${LIFECYCLE_FOLDER}( \\d+)?$`) });
        if ((await folderLink.count()) === 0) await documentsPage.createFolder(LIFECYCLE_FOLDER);
        await rowAction(page, '', id, 'Move to folder');
        const dialog = page.getByRole('dialog', { name: 'Move to folder' });
        await dialog.getByRole('combobox', { name: 'Folder' }).selectOption({ label: LIFECYCLE_FOLDER });
        await dialog.getByRole('button', { name: 'Move', exact: true }).click();
        await expect.poll(async () => (await getDoc(page, id))?.folder_id).toBeTruthy();
        await documentsPage.goto();
        await folderLink.first().click();
        await expect(documentsPage.rowByName(name)).toHaveCount(1, { timeout: 20_000 });
      });

      await test.step('Archive moves it out of All documents into Archive', async () => {
        await rowAction(page, '', id, 'Archive', 'Archive');
        await expect.poll(async () => (await getDoc(page, id))?.archived_at).toBeTruthy();
        await documentsPage.goto();
        await expect(documentsPage.rowByName(name)).toHaveCount(0);
        await page.goto('/documents?folder=archive');
        await expect(documentsPage.rowByName(name)).toHaveCount(1, { timeout: 20_000 });
      });

      await test.step('Unarchive brings it back', async () => {
        const menu = await openRowMenu(page, 'archive', id);
        await bugCheckpoint(KNOWN_BUGS.BUG29, () => expect.soft(menu.getByRole('menuitem', { name: /^(Unarchive|Restore)$/ }), 'Archive view offers no Unarchive (BUG-29)').toHaveCount(1));
        /* Until BUG-29 is fixed the item labelled "Archive" is what unarchives. */
        await menu.getByRole('menuitem', { name: /^(Unarchive|Restore|Archive)$/ }).first().click();
        await expect.poll(async () => (await getDoc(page, id))?.archived_at).toBeNull();
      });

      await test.step('Delete moves it to Trash', async () => {
        await rowAction(page, '', id, 'Delete', 'Move to Trash');
        await expect.poll(async () => (await getDoc(page, id))?.deleted_at).toBeTruthy();
        await documentsPage.goto();
        await expect(documentsPage.rowByName(name)).toHaveCount(0);
        await page.goto('/documents?folder=trash');
        await expect(documentsPage.rowByName(name)).toHaveCount(1, { timeout: 20_000 });
      });
    } finally {
      if (id) await test.step('erase the copy', () => erase(page, id));
    }
  });

  test('BUG-29 archived documents offer Unarchive', knownBug(KNOWN_BUGS.BUG29, ['@data']), async ({ page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const id = await duplicateNewestDraft(page);
    try {
      await rowAction(page, '', id, 'Archive', 'Archive');
      await expect.poll(async () => (await getDoc(page, id))?.archived_at).toBeTruthy();
      const menu = await openRowMenu(page, 'archive', id);
      await expect(menu.getByRole('menuitem', { name: /^(Unarchive|Restore)$/ }), 'Archive view should offer Unarchive').toHaveCount(1, { timeout: 5_000 });
    } finally {
      await page.keyboard.press('Escape').catch(() => undefined);
      await erase(page, id);
    }
  });

  test('BUG-30 Trash offers Restore', knownBug(KNOWN_BUGS.BUG30), async ({ page, documentsPage }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    /* Read-only: inspects the menu and bulk bar of a document already in Trash. */
    await page.goto('/documents?folder=trash');
    await waitForHydration(page);
    const row = documentsPage.rows.first();
    test.skip((await row.count()) === 0, 'Trash is empty');
    const menu = page.getByRole('menu');
    await clickUntilVisible(row.getByRole('button', { name: 'More actions' }), menu);
    await expect(menu.getByRole('menuitem', { name: /^Restore/ }), 'Trash row menu has no Restore').toHaveCount(1, { timeout: 5_000 });
  });

  test('BUG-32 DOC-008 a duplicate folder name is rejected', knownBug(KNOWN_BUGS.BUG32, ['@data']), async ({ page, documentsPage }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await documentsPage.goto();
    const links = page.getByRole('navigation', { name: 'Folders' }).getByRole('link', { name: UNIQUENESS_FOLDER, exact: true });
    /* The fixed folder is created once; later runs try to create it again. */
    if ((await links.count()) === 0) {
      await documentsPage.createFolder(UNIQUENESS_FOLDER);
      await expect(links).toHaveCount(1, { timeout: 20_000 });
    }
    const before = await links.count();
    await documentsPage.createFolder(UNIQUENESS_FOLDER).catch(() => undefined);
    await documentsPage.goto();
    await expect(links, 'a second folder with the same name was created').toHaveCount(before);
  });
});
