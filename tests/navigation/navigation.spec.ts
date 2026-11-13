import { test, expect } from '../../src/fixtures/test';

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

  test('global search opens with keyboard shortcut', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.keyboard.press('Control+k');

    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeVisible();
  });
});
