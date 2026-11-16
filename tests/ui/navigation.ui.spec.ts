import { test, expect } from '../../src/fixtures/test';

/** Application shell: skip link, sidebar, search dialog, account menu, theme toggle. */
test.describe('UI · Application shell', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.goto();
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#sf-main$/);
  });

  test('every sidebar section has a visible, named link', async ({ navigation }) => {
    await navigation.open();
    for (const section of ['Home', 'Documents', 'Contacts', 'Reports', 'Developer', 'Support', 'My account'] as const) {
      await expect(navigation.sectionLink(section)).toBeVisible();
    }
  });

  test('current section is marked in the sidebar', async ({ navigation, page }) => {
    await navigation.goTo('Contacts');
    await expect(page).toHaveURL(/\/contacts/);
    await expect(navigation.sectionLink('Contacts')).toHaveAttribute('aria-current', /page|true/);
  });

  test('search dialog focuses the input and closes on Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('account menu lists named items', async ({ page }) => {
    await page.getByRole('button', { name: /Account and help/ }).click();
    const menu = page.getByRole('menu', { name: 'Account and help' });
    for (const item of ['My account', 'Notifications', 'Start product tour', 'Sign out']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('theme toggle flips its label and is restored', async ({ page }) => {
    const toDark = page.getByRole('button', { name: 'Switch to dark theme' });
    const toLight = page.getByRole('button', { name: 'Switch to light theme' });
    const startDark = await toLight.isVisible().catch(() => false);
    await (startDark ? toLight : toDark).click();
    await expect(startDark ? toDark : toLight).toBeVisible();
    await (startDark ? toDark : toLight).click(); // restore the user's preference
    await expect(startDark ? toLight : toDark).toBeVisible();
  });

  test('sidebar collapses and expands', async ({ page }) => {
    const expand = page.getByRole('button', { name: 'Expand sidebar' });
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    const collapsed = await expand.isVisible().catch(() => false);
    await (collapsed ? expand : collapse).click();
    await expect(collapsed ? collapse : expand).toBeVisible();
    await (collapsed ? collapse : expand).click();
    await expect(collapsed ? expand : collapse).toBeVisible();
  });
});
