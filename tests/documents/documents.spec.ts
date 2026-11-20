import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

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

  test('exposes every filter dimension', async ({ documentsPage }) => {
    await documentsPage.openFilters();

    await expect(documentsPage.statusFilter).toBeVisible();
    await expect(documentsPage.typeFilter).toBeVisible();
    await expect(documentsPage.timeFilter).toBeVisible();
    await expect(documentsPage.ownerFilter).toBeVisible();

    const statuses = await documentsPage.statusFilter.locator('option').allTextContents();
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
    const options = await documentsPage.sortSelect.locator('option').allTextContents();
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
