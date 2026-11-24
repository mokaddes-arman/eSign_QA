import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectOpenBugsToFail } from '../../src/helpers/bugs';
import { unlabeledControls } from '../../src/helpers/ui';
import { uiBaseline } from '../../src/helpers/uiSuite';

test.describe('UI · Contacts', () => {
  uiBaseline([{ name: 'Contacts', path: '/contacts', ready: (p) => p.getByRole('heading', { level: 1, name: 'Contacts' }) }]);

  test('new-contact dialog is fully labelled and closes on Escape', async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.openNewContact();
    expect(await unlabeledControls(contactsPage.dialog)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(contactsPage.dialog).toBeHidden();
  });

  test('BUG-17 saving without a name flags the field and keeps the dialog open', knownBug(KNOWN_BUGS.BUG17), async ({ contactsPage }) => {
    expectOpenBugsToFail();
    await contactsPage.goto();
    await contactsPage.openNewContact();
    await contactsPage.emailInput.fill('qa.ui@example.com');
    await contactsPage.saveButton.click();
    await expect(contactsPage.dialog).toBeVisible();
    const flagged =
      (await contactsPage.fullNameInput.getAttribute('aria-invalid')) === 'true' ||
      !(await contactsPage.fullNameInput.evaluate((el: HTMLInputElement) => el.checkValidity())) ||
      (await contactsPage.dialog.locator('[role="alert"], .env-field-error').filter({ hasText: /\S/ }).count()) > 0;
    expect(flagged, 'Save with a blank name did nothing: no message and the field is not flagged').toBe(true);
    await contactsPage.cancelButton.click();
  });

  test('group filters are offered', async ({ contactsPage, page }) => {
    await contactsPage.goto();
    for (const group of ['Customers', 'Internal', 'Counsel', 'Vendors']) {
      await expect(page.getByRole('main').getByText(group, { exact: false }).first()).toBeVisible();
    }
  });
});
