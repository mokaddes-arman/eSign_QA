import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { requireData } from '../../src/helpers/precondition';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { clickUntilVisible } from '../../src/helpers/wait';

/* Read-only checks of library controls: menus are opened and dismissed, nothing is chosen. */
test.describe('Documents library actions', () => {
  test.beforeEach(async ({ documentsPage }) => {
    await documentsPage.goto();
  });

  test('row actions menu lists every lifecycle action', async ({ documentsPage, page, request }) => {
    requireData((await (await request.get(API.documents)).json()).length > 0, 'the workspace has no documents (API)');
    await expect(page.getByRole('button', { name: 'More actions' }).first(), 'Documents exist but no row "More actions" button was found').toBeVisible();

    await page.getByRole('button', { name: 'More actions' }).first().click();
    const menu = page.getByRole('menu', { name: /^Actions for / });
    for (const item of [
      'Open',
      'Copy link',
      'Add fields',
      'Make template',
      /* 'Notarize' was removed from the product (20 Nov 2026). */
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

  test('DOC-019 grid layout and bulk selection change what the library shows', async ({ page, request }) => {
    const total = ((await (await request.get(API.documents)).json()) as unknown[]).length;
    requireData(total >= 2, 'bulk selection needs at least two documents (API)');
    const layout = page.getByRole('group', { name: 'Layout' });
    const list = page.getByRole('list', { name: 'Documents' });
    const rows = list.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Select', exact: true }) });

    /* Layout: Grid becomes the pressed option and the same documents render as cards. */
    await expect(layout.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(total);
    const listLabel = await rows.first().innerText();
    await layout.getByRole('button', { name: 'Grid' }).click();
    await expect(layout.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    await expect(layout.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveCount(total);
    await expect.poll(async () => rows.first().innerText(), { message: 'Grid cards should render differently from list rows' }).not.toBe(listLabel);
    await layout.getByRole('button', { name: 'List' }).click();
    await expect(layout.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');

    /* Bulk: one row → bar with "1 selected" and the bulk actions; select all → N; Clear → gone. */
    const bar = page.getByRole('group', { name: 'Selection actions' });
    await expect(bar).toHaveCount(0);
    await rows.first().getByRole('checkbox', { name: 'Select', exact: true }).check();
    await expect(bar).toContainText('1 selected');
    for (const action of ['Move', 'Archive', 'Download', 'Delete']) await expect(bar.getByRole('button', { name: action, exact: true })).toBeVisible();
    expect(await page.getByRole('checkbox', { name: 'Select all documents' }).evaluate((el) => (el as HTMLInputElement).indeterminate), 'header checkbox should be mixed').toBe(true);

    await bar.getByRole('button', { name: `Select all ${total}` }).click();
    await expect(bar).toContainText(`${total} selected`);
    for (const box of await rows.getByRole('checkbox').all()) await expect(box).toBeChecked();

    await bar.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(bar).toHaveCount(0);
    for (const box of await rows.getByRole('checkbox').all()) await expect(box).not.toBeChecked();
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

  test('BUG-46 DOC-014 a document can be favourited and then appears under Favourites', knownBug(KNOWN_BUGS.BUG46), async ({ page, request }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    requireData(((await (await request.get(API.documents)).json()) as unknown[]).length > 0, 'the workspace has no documents (API)');
    /* Look everywhere a favourite control could live: the row, the grid card, the row menu. */
    const favourite = /favou?rite|^star\b|add to favou?rites/i;
    const row = page.getByRole('list', { name: 'Documents' }).getByRole('listitem').filter({ has: page.getByRole('button', { name: 'More actions' }) }).first();
    const inRow = await row.getByRole('button', { name: favourite }).count();
    const menu = page.getByRole('menu');
    await clickUntilVisible(row.getByRole('button', { name: 'More actions' }), menu);
    const inMenu = await menu.getByRole('menuitem', { name: favourite }).count();
    await page.keyboard.press('Escape');
    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Grid' }).click();
    const inCard = await row.getByRole('button', { name: favourite }).count();
    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'List' }).click();
    expect(inRow + inMenu + inCard, 'no control favourites a document (row, grid card or row menu), so the Favourites view can never fill').toBeGreaterThan(0);
  });

  test('unknown document id shows a not-available state', async ({ page }) => {
    await page.goto('/documents/00000000-0000-0000-0000-000000000000/prepare');
    await expect(page.getByText("This document isn't available")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to documents' })).toBeVisible();
  });
});
