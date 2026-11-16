import { test, expect } from '../../src/fixtures/test';
import { uiBaseline } from '../../src/helpers/uiSuite';

test.describe('UI · Documents library', () => {
  uiBaseline([
    { name: 'All documents', path: '/documents', ready: (p) => p.getByRole('heading', { level: 1, name: 'Documents' }) },
    { name: 'Templates folder', path: '/documents?folder=templates', ready: (p) => p.getByRole('heading', { level: 2, name: 'Templates' }) },
    /* BUG-16 (hydration error #418) was seen here once but not reproduced on re-run. */
    { name: 'Trash folder', path: '/documents?folder=trash', ready: (p) => p.getByRole('heading', { level: 1, name: 'Documents' }) },
  ]);

  test('a search with no matches shows a friendly empty state', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    await documentsPage.searchInput.fill(`zz-no-match-${Date.now()}`);
    await page.keyboard.press('Enter');
    await expect(page.getByText(/no (documents|results|matches)|nothing (found|in)|Showing 0/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('row actions menu returns focus to its trigger on Escape', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    const trigger = page.getByRole('button', { name: 'More actions' }).first();
    test.skip((await trigger.count()) === 0, 'No documents in the workspace');
    await trigger.click();
    await expect(page.getByRole('menu').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('new-folder dialog is labelled and cancellable', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    await documentsPage.newFolderButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox', { name: 'Folder name' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('result count is shown', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    await expect(page.getByText(/Showing \d+ of \d+/).first()).toBeVisible();
  });
});
