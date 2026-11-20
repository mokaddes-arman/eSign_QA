import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

/**
 * UF-11 — personalise the shell. The theme is saved to the ACCOUNT ("applies on every
 * device"), so this spec runs in `chromium-account` (serial) and always restores it.
 * The sidebar fold is per-browser (localStorage `sf.sidebar.folded`).
 */
test.describe('Flow · Personalise the shell', () => {
  test('UF-11 NAV-006 ACC-004 theme toggle persists after reload and matches the account colour mode @flow', async ({ overviewPage, profilePage, page }) => {
    await overviewPage.goto();
    const toDark = page.getByRole('button', { name: 'Switch to dark theme' });
    const toLight = page.getByRole('button', { name: 'Switch to light theme' });
    const startDark = await toLight.isVisible();
    const [flip, flipped, target] = startDark ? [toLight, toDark, 'light'] : [toDark, toLight, 'dark'];
    const mode = page.getByRole('radiogroup', { name: 'Colour mode' });

    try {
      await clickUntilVisible(flip, flipped);
      await expect(page.locator('html')).toHaveAttribute('data-theme', target);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(flipped, 'theme choice was lost on reload').toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', target);

      await profilePage.goto();
      await expect(mode.getByRole('radio', { name: target === 'dark' ? 'Dark' : 'Light', exact: true })).toBeChecked();
    } finally {
      await overviewPage.goto();
      if (await flipped.isVisible()) await clickUntilVisible(flipped, flip);
      await expect(page.locator('html')).toHaveAttribute('data-theme', startDark ? 'dark' : 'light');
    }
  });

  test('UF-11 NAV-007 collapsed sidebar stays collapsed after reload @flow', async ({ overviewPage, page }) => {
    await overviewPage.goto();
    const expand = page.getByRole('button', { name: 'Expand sidebar' });
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    test.skip(!(await collapse.isVisible()), 'Sidebar starts collapsed in this browser');

    await clickUntilVisible(collapse, expand);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(expand, 'sidebar fold was lost on reload').toBeVisible();
    await clickUntilVisible(expand, collapse);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(collapse, 'expanded sidebar was lost on reload').toBeVisible();
  });
});
