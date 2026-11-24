import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

/**
 * UF-44 / ACC-022 — branding plan gate.
 *
 * On the Free plan the page must show the gate. On a paid plan the feature must work end to end:
 * create a theme, see it become the default, edit its wording, see the invitation preview follow,
 * then delete it. A new theme becomes the organization default (it re-brands every envelope that
 * picked none), so this runs in `chromium-account`, after the builder specs, and always deletes it.
 */
const THEME = 'QA Theme (lifecycle check)';

test.describe('Branding themes @flow', () => {
  test('ACC-022 UF-44 branding follows the plan: gated on Free, full theme lifecycle on paid plans @data', async ({ page }) => {
    const usage = await (await page.request.get(API.billingUsage)).json();
    await page.goto('/account/brand');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Branding themes' })).toBeVisible();

    if (!usage.features.custom_branding) {
      await expect(page.getByText(`Branding is not included in the ${usage.plan_name} plan.`), `${usage.plan_name} plan must show the branding gate`).toBeVisible();
      await expect(page.getByRole('link', { name: 'View plans' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'New theme' })).toHaveCount(0);
      return;
    }

    await expect(page.getByText(/not included in the .* plan/i), `Branding must not be gated on the ${usage.plan_name} plan`).toHaveCount(0);
    const themes = page.getByRole('region', { name: 'Themes', exact: true });
    const themeButton = themes.getByRole('button', { name: new RegExp(`^${THEME.replace(/[()]/g, '\\$&')}`) });
    const editor = page.getByRole('region', { name: THEME, exact: true });
    const preview = page.getByRole('region', { name: 'Invitation preview' });

    try {
      /* A leftover from an interrupted run is reused instead of adding a second theme. */
      if ((await themeButton.count()) === 0) {
        const dialog = page.getByRole('dialog', { name: 'New branding theme' });
        await clickUntilVisible(themes.getByRole('button', { name: 'New theme' }), dialog);
        await dialog.getByRole('textbox', { name: 'Theme name' }).fill(THEME);
        await dialog.getByRole('button', { name: 'Create theme' }).click();
        await expect(dialog).toBeHidden();
      }
      await expect(themeButton).toHaveCount(1);
      await themeButton.click();
      await expect(editor.getByRole('textbox', { name: 'Theme name' })).toHaveValue(THEME);

      /* The only theme is the default one, and the preview renders its wording. */
      if ((await themes.getByRole('button').count()) === 2) await expect(themeButton).toContainText('Default');
      const headline = `QA headline ${Date.now()}`;
      await editor.getByRole('textbox', { name: 'Invitation headline' }).fill(headline);
      await expect(preview).toContainText(headline);
      await editor.getByRole('button', { name: 'Save changes' }).click();
      await expect(editor.getByRole('button', { name: 'Saved' })).toBeDisabled();

      /* Saved on the server: a reload shows the same headline. */
      await page.reload();
      await waitForHydration(page);
      await themeButton.click();
      await expect(editor.getByRole('textbox', { name: 'Invitation headline' })).toHaveValue(headline);
      await expect(preview).toContainText(headline);
    } finally {
      if (await themeButton.count()) {
        await themeButton.click();
        const confirm = page.getByRole('dialog', { name: `Delete ${THEME}?` });
        await clickUntilVisible(editor.getByRole('button', { name: 'Delete theme' }), confirm);
        await confirm.getByRole('button', { name: 'Delete theme' }).click();
      }
    }
    await expect(themeButton).toHaveCount(0);
  });
});
