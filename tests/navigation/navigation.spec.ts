import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

test.describe('Authenticated navigation', () => {
  test('exposes every module in the main navigation @smoke', async ({
    overviewPage,
    navigation,
  }) => {
    await overviewPage.goto();
    await navigation.open();

    for (const section of [
      'Home',
      'Documents',
      'Contacts',
      'Reports',
      'Developer',
      'Support',
      'My account',
    ] as const) {
      await expect(navigation.sectionLink(section)).toBeVisible();
    }

    await expect(navigation.createLink).toBeVisible();
    await expect(navigation.planUsageLink).toBeVisible();
  });

  test('navigates to Contacts from the sidebar', async ({ page, overviewPage, navigation }) => {
    await overviewPage.goto();
    await navigation.goTo('Contacts');
    await expect(page).toHaveURL(/\/contacts/);
  });

  test('shows the account and help menu', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.getByRole('button', { name: /Account and help/ }).click();

    const menu = page.getByRole('menu', { name: 'Account and help' });
    await expect(menu.getByText('Mokaddes SQA', { exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Start product tour' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('unknown routes return the 404 page', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "That page isn't here" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open documents' })).toBeVisible();
  });

  test('global search returns grouped results', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await dialog.getByRole('combobox', { name: 'Search' }).fill('sample');

    const results = dialog.getByRole('listbox', { name: 'Search results' });
    await expect(results.getByRole('group', { name: 'Documents' })).toBeVisible();
    await expect(results.getByRole('option', { name: /See all documents matching/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('notifications bell opens a popover linking to the centre', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    const popover = page.getByRole('dialog', { name: 'Notifications' });
    await clickUntilVisible(page.getByRole('button', { name: 'Notifications' }).first(), popover);
    await popover.getByRole('link', { name: 'See all notifications' }).click();
    await expect(page).toHaveURL(/\/notifications/);
  });

  test('product tour starts and can be skipped', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    const tour = page.getByRole('dialog', { name: 'Product tour' });
    await clickUntilVisible(page.getByRole('button', { name: 'Take the tour' }), tour.getByText(/Step 1 of \d+/));
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour).toBeHidden();
  });

  test('global search opens with keyboard shortcut', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.keyboard.press('Control+k');

    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeVisible();
  });
});
