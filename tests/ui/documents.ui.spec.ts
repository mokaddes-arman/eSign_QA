import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { requireData } from '../../src/helpers/precondition';
import { uiBaseline } from '../../src/helpers/uiSuite';
import { clickUntilVisible } from '../../src/helpers/wait';

test.describe('UI · Documents library', () => {
  uiBaseline([
    { name: 'All documents', path: '/documents', ready: (p) => p.getByRole('heading', { level: 1, name: 'Documents' }) },
    { name: 'Templates folder', path: '/documents?folder=templates', ready: (p) => p.getByRole('heading', { level: 2, name: 'Templates' }) },
    /* BUG-16 (hydration error #418) was seen here once but not reproduced on re-run. */
    { name: 'Trash folder', path: '/documents?folder=trash', ready: (p) => p.getByRole('heading', { level: 1, name: 'Documents' }) },
  ]);

  test('a search with no matches shows a friendly empty state', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    /* Text typed before hydration is discarded (R3): retry until the query is committed to the URL. */
    await expect(async () => {
      await documentsPage.searchInput.fill(`zz-no-match-${Date.now()}`);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/[?&]q=zz-no-match/, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText(/no (documents|results|matches)|nothing (found|in)|Showing 0/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('row actions menu returns focus to its trigger on Escape', async ({ documentsPage, page, request }) => {
    requireData((await (await request.get(API.documents)).json()).length > 0, 'the workspace has no documents (API)');
    await documentsPage.goto();
    const trigger = page.getByRole('button', { name: 'More actions' }).first();
    await expect(trigger, 'Documents exist but no row "More actions" button was found').toBeVisible();
    await clickUntilVisible(trigger, page.getByRole('menu').first());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('new-folder dialog is labelled and cancellable', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    const dialog = page.getByRole('dialog');
    await clickUntilVisible(documentsPage.newFolderButton, dialog.getByRole('textbox', { name: 'Folder name' }));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('result count is shown', async ({ documentsPage, page }) => {
    await documentsPage.goto();
    await expect(page.getByText(/Showing \d+ of \d+/).first()).toBeVisible();
  });
});
