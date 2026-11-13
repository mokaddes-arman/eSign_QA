import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';

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

  test('exposes every filter dimension', async ({ documentsPage, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'Known Firefox renderer crash ("Page crashed") when reading <select> options on /documents.',
    );
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

  test('sorts the list by name and status', async ({ documentsPage, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'Known Firefox renderer crash ("Page crashed") when reading <select> options on /documents.',
    );
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

  test('uploads a document and opens the prepare builder @quota', async ({
    documentsPage,
    page,
  }) => {
    test.skip(
      process.env.RUN_UPLOAD !== 'true',
      'Creates a draft and consumes a free-plan signature request. Set RUN_UPLOAD=true to run.',
    );

    await documentsPage.uploadDocument(SAMPLE_DOC);

    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/);
    await expect(page.getByRole('heading', { name: 'Prepare document' })).toBeVisible();
  });
});
