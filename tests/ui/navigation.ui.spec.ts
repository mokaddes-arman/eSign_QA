import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

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
    const menu = page.getByRole('menu', { name: 'Account and help' });
    await clickUntilVisible(page.getByRole('button', { name: /Account and help/ }), menu);
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
    /* Clicks only while the flipped label is absent, so the toggle never fires twice (R3). */
    await clickUntilVisible(startDark ? toLight : toDark, startDark ? toDark : toLight);
    await clickUntilVisible(startDark ? toDark : toLight, startDark ? toLight : toDark); // restore the user's preference
  });

  test('sidebar collapses and expands', async ({ page }) => {
    const expand = page.getByRole('button', { name: 'Expand sidebar' });
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    const collapsed = await expand.isVisible().catch(() => false);
    await clickUntilVisible(collapsed ? expand : collapse, collapsed ? collapse : expand);
    await clickUntilVisible(collapsed ? collapse : expand, collapsed ? expand : collapse); // restore
  });
});
