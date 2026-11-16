import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectBugsToFail } from '../../src/helpers/bugs';
import { expectErrorStyled, unlabeledControls } from '../../src/helpers/ui';
import { uiBaseline } from '../../src/helpers/uiSuite';

test.describe('UI · Support', () => {
  uiBaseline([{ name: 'Support', path: '/support', ready: (p) => p.getByRole('heading', { level: 1, name: 'Support' }) }]);

  test('new-ticket dialog is fully labelled', async ({ supportPage, page }) => {
    await supportPage.goto();
    await supportPage.openNewTicket();
    expect(await unlabeledControls(supportPage.dialog)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(supportPage.dialog).toBeHidden();
  });

  test('BUG-11 empty ticket submit explains what is missing', knownBug(KNOWN_BUGS.BUG11), async ({ supportPage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await supportPage.goto();
    await supportPage.openNewTicket();
    await supportPage.submitButton.click();
    await expect(supportPage.dialog).toBeVisible();
    const error = supportPage.dialog
      .locator('[role="alert"], .env-field-error, [aria-live]')
      .filter({ hasText: /\S/ })
      .first();
    await expect(error, 'no validation message is shown for the empty ticket').toBeVisible({ timeout: 5_000 });
    await expectErrorStyled(error, 'ticket validation message');
    await page.keyboard.press('Escape');
  });
});
