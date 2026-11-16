import { test, expect } from '../../src/fixtures/test';

/** UF-14 / UF-16 — find a draft in the library, open it in the builder and return. */
test.describe('Flow · Documents library', () => {
  test('UF-16 sender finds a draft, opens it and returns to the library @flow', async ({ documentsPage, preparePage, page }) => {
    let title = '';

    await test.step('open the Drafts view', async () => {
      await documentsPage.goto();
      await documentsPage.openFolder('Drafts');
      await expect(page).toHaveURL(/folder=drafts|view=drafts/);
      test.skip((await page.getByRole('button', { name: 'More actions' }).count()) === 0, 'No drafts in the workspace');
    });

    await test.step('search narrows the list to the draft', async () => {
      title = ((await documentsPage.rowTitle(documentsPage.rows.first()).innerText()) || '').trim();
      test.skip(!title, 'Could not read a draft title');
      await documentsPage.searchInput.fill(title.slice(0, 10));
      await page.keyboard.press('Enter');
      /* The search is debounced and committed to ?q=; the list re-renders after that. */
      await expect(page).toHaveURL(/[?&]q=/, { timeout: 10_000 });
      await documentsPage.settle();
      await expect(documentsPage.rowByName(title).first()).toBeVisible();
      await expect(page.getByText(/Showing \d+ of \d+/).first()).toBeVisible();
    });

    await test.step('open the draft in the builder', async () => {
      const open = () => documentsPage.rowTitle(documentsPage.rowByName(title).first()).click();
      await open();
      /* A click that lands during a re-render is dropped; retry once. */
      const opened = await page
        .waitForURL(/\/documents\/[0-9a-f-]+\/prepare/, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) await open();
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/, { timeout: 15_000 });
      await expect(preparePage.heading).toBeVisible();
    });

    await test.step('Save and close returns to the library', async () => {
      await preparePage.settle();
      await preparePage.saveAndCloseButton.click();
      await expect(page).toHaveURL(/\/documents(\?|$)/, { timeout: 15_000 });
      await expect(documentsPage.heading).toBeVisible();
    });
  });
});
