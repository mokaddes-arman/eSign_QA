import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

/** UF-39 — a user edits their profile, sees it persist, and the change is reverted. */
test.describe('Flow · Account profile', () => {
  test('UF-39 time zone change saves, persists and reverts @flow', async ({ profilePage, page }) => {
    await profilePage.goto();
    const field = profilePage.timeZoneSelect;
    const isSelect = (await field.evaluate((el) => el.tagName)) === 'SELECT';
    const original = await field.inputValue();
    const next = original === 'Europe/London' ? 'America/New_York' : 'Europe/London';

    const setValue = async (value: string) => {
      if (isSelect) await field.selectOption(value);
      else {
        await field.fill(value);
        await field.press('Tab');
      }
    };

    try {
      await test.step('Save enables only when the form is dirty', async () => {
        await expect(profilePage.saveButton).toBeDisabled();
        /* Typing before hydration is discarded (TEST_PLAN R3): retry until the form registers it as dirty. */
        await expect(async () => {
          if (!isSelect) await field.fill('');
          await setValue(next);
          await expect(profilePage.saveButton).toBeEnabled({ timeout: 3_000 });
        }).toPass({ timeout: 20_000 });
      });

      await test.step('save and confirm', async () => {
        await profilePage.saveButton.click();
        await expect(profilePage.saveButton).toBeDisabled({ timeout: 10_000 });
      });

      await test.step('value persists after reload', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(profilePage.heading).toBeVisible();
        await expect(field).toHaveValue(next);
      });
    } finally {
      await test.step('revert', async () => {
        if ((await field.inputValue()) !== original) {
          await setValue(original);
          await profilePage.saveButton.click();
          await expect(profilePage.saveButton).toBeDisabled({ timeout: 10_000 });
        }
      });
    }
  });

  test('ACC-012 a notification preference persists after reload and reverts @flow', async ({ page }) => {
    /* An off-by-default, low-impact event: no e-mail is triggered by toggling it. */
    const toggle = page.getByRole('switch', { name: 'Weekly activity summary' });
    /* Preferences load client-side after hydration ("Loading your notification preferences…"). */
    const open = async () => {
      await waitForHydration(page);
      await expect(toggle).toBeVisible({ timeout: 30_000 });
    };
    await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
    await open();
    const was = (await toggle.getAttribute('aria-checked')) === 'true';
    const set = async (on: boolean) =>
      expect(async () => {
        if (((await toggle.getAttribute('aria-checked')) === 'true') !== on) await toggle.click();
        await expect(toggle).toHaveAttribute('aria-checked', String(on), { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    try {
      await set(!was);
      await expect(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await open();
        await expect(toggle).toHaveAttribute('aria-checked', String(!was), { timeout: 5_000 });
      }, 'preference was not saved').toPass({ timeout: 60_000 });
    } finally {
      await set(was);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await open();
      await expect(toggle).toHaveAttribute('aria-checked', String(was));
    }
  });

  test('ACC-006 UF-40 adopt a typed signature, see it as default, then remove it @flow @data', async ({ profilePage, page }) => {
    await profilePage.goto();
    const region = page.getByRole('region', { name: 'Signatures' });
    await expect(region).toBeVisible();
    /* Never touch a signature the account owner adopted. */
    test.skip(!(await region.getByText('No signature adopted yet').isVisible()), 'Account already has a signature');
    const dialog = page.getByRole('dialog', { name: 'Adopt your signature' });
    try {
      await clickUntilVisible(region.getByRole('button', { name: 'Add signature' }), dialog);
      await dialog.getByRole('tab', { name: 'Type' }).click();
      await expect(dialog.getByRole('textbox', { name: 'Typed signature text' })).not.toHaveValue('');
      await dialog.getByRole('button', { name: 'Adopt signature' }).click();
      await expect(dialog).toBeHidden();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(region.getByText(/Typed · adopted/)).toBeVisible({ timeout: 20_000 });
      await expect(region.getByText('Default', { exact: true })).toBeVisible();
    } finally {
      /* Only the signature this test adopted exists (the test skips otherwise). */
      const confirm = page.getByRole('dialog', { name: 'Remove this signature?' });
      if (await region.getByRole('button', { name: 'Remove' }).isVisible().catch(() => false)) {
        await clickUntilVisible(region.getByRole('button', { name: 'Remove' }), confirm);
        await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
      }
      await expect(region.getByText('No signature adopted yet')).toBeVisible({ timeout: 20_000 });
    }
  });
});
