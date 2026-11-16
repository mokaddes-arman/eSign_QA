import { test, expect } from '../../src/fixtures/test';

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
        await setValue(next);
        await expect(profilePage.saveButton).toBeEnabled();
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
});
