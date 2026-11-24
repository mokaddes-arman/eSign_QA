import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';
import { clickUntilVisible } from '../../src/helpers/wait';
import { API } from '../../src/helpers/api';
import type { Locator } from '@playwright/test';

const SAMPLE_DOC = path.resolve(__dirname, '../fixtures/sample-agreement.png');

test.describe('Documents library @smoke', () => {
  test.beforeEach(async ({ documentsPage }) => {
    await documentsPage.goto();
  });

  test('renders folders, views and toolbar', async ({ documentsPage }) => {
    await expect(documentsPage.heading).toBeVisible();
    await expect(documentsPage.searchInput).toBeVisible();
    await expect(documentsPage.uploadPrepareButton).toBeVisible();
    await expect(documentsPage.newFolderButton).toBeVisible();

    for (const view of [
      'Templates',
      'Archive',
      'Trash',
      'Waiting for me',
      'Waiting for others',
      'Drafts',
      'Completed',
      'Expiring soon',
      'Favourites',
      'Shared with me',
      'Owned by me',
    ] as const) {
      await expect(documentsPage.folderLink(view)).toBeVisible();
    }
  });

  test('DOC-001 folder and view counts match the workspace data', async ({ documentsPage, page }) => {
    const [me, docs, templates, folders] = await Promise.all([
      page.request.get(API.me).then((r) => r.json()),
      page.request.get(API.documents).then((r) => r.json()),
      page.request.get(API.templates).then((r) => r.json()),
      page.request.get(API.folders).then((r) => r.json()),
    ]);
    /* Counts render after the label ("All documents 6"); a zero count is omitted ("Archive"). */
    const count = async (link: Locator) => Number(((await link.textContent()) ?? '').match(/(\d+)\s*$/)?.[1] ?? 0);
    const folderNav = page.getByRole('navigation', { name: 'Folders' });
    const viewNav = page.getByRole('navigation', { name: 'Views' });

    await expect(documentsPage.heading).toBeVisible();
    await expect(page.getByRole('region', { name: 'Documents' }).getByText(/^\d+ documents?$/)).toHaveText(`${docs.length} document${docs.length === 1 ? '' : 's'}`);
    expect(await count(folderNav.getByRole('link', { name: /^All documents/ })), 'All documents vs documents API').toBe(docs.length);
    expect(await count(folderNav.getByRole('link', { name: /^Templates/ })), 'Templates vs templates API').toBe(templates.items.length);
    const mine = (docs as { owner_user_id: string }[]).filter((d) => d.owner_user_id === me.id).length;
    expect(await count(viewNav.getByRole('link', { name: /^Owned by me/ })), 'Owned by me vs documents owned by the signed-in user').toBe(mine);

    /* Every folder the API knows is listed (same number of entries per name — names are not unique, BUG-32). */
    const expected = new Map<string, number>();
    for (const f of (Array.isArray(folders) ? folders : folders.items) as { name: string }[]) expected.set(f.name, (expected.get(f.name) ?? 0) + 1);
    const listed = new Map<string, number>();
    for (const t of await folderNav.getByRole('link').allTextContents()) {
      const name = t.trim();
      if (/^(All documents|Templates|Archive|Trash)\s*\d*$/.test(name)) continue;
      listed.set(name, (listed.get(name) ?? 0) + 1);
    }
    expect(Object.fromEntries(listed), 'Folders list vs folders API').toEqual(Object.fromEntries(expected));
    await expect(page.getByText(/^Showing \d+ of \d+ documents?$/)).toHaveText(`Showing ${docs.length} of ${docs.length} document${docs.length === 1 ? '' : 's'}`);
  });

  test('exposes every filter dimension', async ({ documentsPage }) => {
    await documentsPage.openFilters();

    await expect(documentsPage.statusFilter).toBeVisible();
    await expect(documentsPage.typeFilter).toBeVisible();
    await expect(documentsPage.timeFilter).toBeVisible();
    await expect(documentsPage.ownerFilter).toBeVisible();

    const statuses = await optionLabels(documentsPage.statusFilter);
    expect(statuses).toEqual(
      expect.arrayContaining([
        'All statuses',
        'Action required',
        'Waiting for others',
        'Completed',
        'Drafts',
        'Voided',
      ]),
    );
  });

  test('sorts the list by name and status', async ({ documentsPage }) => {
    const options = await optionLabels(documentsPage.sortSelect);
    expect(options).toEqual(expect.arrayContaining(['Recent', 'Name', 'Status', 'Owner']));

    await documentsPage.selectSort('Name');
    await expect(documentsPage.sortSelect).toHaveValue(/name/i);
  });

  test('opens the templates folder', async ({ documentsPage }) => {
    await documentsPage.openFolder('Templates');
    await expect(documentsPage.page).toHaveURL(/folder=templates/);
    await expect(documentsPage.page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  });

  test('creates a folder and shows it in the sidebar @data', async ({ documentsPage }, testInfo) => {
    const folder = `QA Folder ${Date.now()}`;
    await documentsPage.createFolder(folder);

    await expect(documentsPage.page.getByText(folder, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await testInfo.attach('folder-name', { body: folder, contentType: 'text/plain' });
  });

  test('DOC-008 a blank or whitespace-only folder name cannot be created', async ({ documentsPage, page }) => {
    const dialog = page.getByRole('dialog', { name: 'New folder' });
    await clickUntilVisible(documentsPage.newFolderButton, dialog);
    const create = dialog.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Folder name' }).fill('   ');
    await expect(create, 'whitespace-only name enables Create').toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
