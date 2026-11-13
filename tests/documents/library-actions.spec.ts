import { test, expect } from '../../src/fixtures/test';

/* Read-only checks of library controls: menus are opened and dismissed, nothing is chosen. */
test.describe('Documents library actions', () => {
  test.beforeEach(async ({ documentsPage }) => {
    await documentsPage.goto();
  });

  test('row actions menu lists every lifecycle action', async ({ documentsPage, page }) => {
    test.skip((await page.getByRole('button', { name: 'More actions' }).count()) === 0, 'No documents in workspace');

    await page.getByRole('button', { name: 'More actions' }).first().click();
    const menu = page.getByRole('menu', { name: /^Actions for / });
    for (const item of [
      'Open',
      'Copy link',
      'Add fields',
      'Make template',
      'Notarize',
      'Download',
      'Print',
      'Move to folder',
      'Duplicate',
      'Rename',
      'Archive',
      'Delete',
    ]) {
      await expect(menu.getByRole('menuitem', { name: item, exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(documentsPage.heading).toBeVisible();
  });

  test('offers list/grid layout and bulk selection', async ({ page }) => {
    const layout = page.getByRole('group', { name: 'Layout' });
    await expect(layout.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    await expect(layout.getByRole('button', { name: 'Grid' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Select all documents' })).toBeVisible();
  });

  test('form catalog opens from the templates folder', async ({ documentsPage, page }) => {
    await documentsPage.openFolder('Templates');
    /* The folder switch is client-routed: wait for the Templates view before clicking. */
    await expect(page).toHaveURL(/folder=templates/);
    await expect(page.getByRole('heading', { level: 2, name: 'Templates' })).toBeVisible();
    await page.getByRole('button', { name: 'Browse form catalog' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Form catalog' });
    await expect(dialog.getByRole('searchbox', { name: 'Search the form catalog' })).toBeVisible();
    await expect(dialog.getByLabel('Filter the catalog by category')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close the form catalog' }).click();
    await expect(dialog).toBeHidden();
  });

  test('unknown document id shows a not-available state', async ({ page }) => {
    await page.goto('/documents/00000000-0000-0000-0000-000000000000/prepare');
    await expect(page.getByText("This document isn't available")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to documents' })).toBeVisible();
  });
});
