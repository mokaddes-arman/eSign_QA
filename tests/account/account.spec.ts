import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { waitForHydration } from '../../src/helpers/wait';
import { API } from '../../src/helpers/api';
import { requireData } from '../../src/helpers/precondition';

test.describe('Account · profile & security', () => {
  test('shows profile details for the signed-in user @smoke', async ({ profilePage, page }) => {
    await profilePage.goto();

    await expect(profilePage.heading).toBeVisible();
    await expect(profilePage.fullNameInput).toHaveValue(/Mokaddes/);
    await expect(profilePage.emailInput).toHaveValue(/esignTest@gmail\.com/i);
    await expect(page.getByText(/Email verified/)).toBeVisible();
  });

  test('ACC-005 signature dialog: each method offers its own input and an empty signature is not adopted', async ({ profilePage, page }) => {
    await profilePage.goto();
    await expect(profilePage.changePasswordButton).toBeVisible();
    await expect(profilePage.themeGroup).toBeVisible();
    const signaturesBefore = await page.getByRole('region', { name: 'Signatures' }).textContent();

    await profilePage.openSignatureDialog();
    const dialog = profilePage.signatureDialog;
    const methods = dialog.getByRole('tablist', { name: 'Signature method' });
    await expect(methods.getByRole('tab')).toHaveText(['Draw', 'Type', 'Upload']);
    await expect(methods.getByRole('tab', { name: 'Draw' })).toHaveAttribute('aria-selected', 'true');

    /* Draw: a canvas with ink and stroke controls. Adopting a blank canvas saves nothing. */
    await expect(dialog.locator('canvas')).toHaveCount(1);
    await expect(dialog.getByRole('group', { name: 'Ink' }).getByRole('button', { name: 'Black ink' })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('group', { name: 'Ink' }).getByRole('button', { name: 'Blue ink' }).click();
    await expect(dialog.getByRole('group', { name: 'Ink' }).getByRole('button', { name: 'Blue ink' })).toHaveAttribute('aria-pressed', 'true');
    const writes: string[] = [];
    page.on('request', (r) => { if (r.method() !== 'GET' && /signature/i.test(r.url())) writes.push(`${r.method()} ${r.url()}`); });
    await dialog.getByRole('button', { name: 'Adopt signature' }).click();
    await expect(dialog).toBeVisible();
    expect(writes, 'a blank drawn signature must not be saved').toEqual([]);

    /* Type: the text drives every font preview; picking a font selects it. */
    await methods.getByRole('tab', { name: 'Type' }).click();
    await expect(methods.getByRole('tab', { name: 'Type' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.locator('canvas')).toHaveCount(0);
    await dialog.getByRole('textbox', { name: 'Typed signature text' }).fill('QA Signature Check');
    const fonts = dialog.getByRole('button', { name: /^QA Signature Check / });
    await expect(fonts).toHaveCount(4);
    await fonts.nth(2).click();
    await expect(fonts.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(fonts.nth(0)).toHaveAttribute('aria-pressed', 'false');

    /* Upload: a file picker for PNG/JPG. */
    await methods.getByRole('tab', { name: 'Upload' }).click();
    await expect(dialog.getByRole('button', { name: /Drop a PNG or JPG of your signature/ })).toBeVisible();
    const picker = dialog.locator('input[type=file]');
    await expect(picker).toHaveCount(1);
    expect((await picker.getAttribute('accept')) ?? '', 'the picker should accept PNG and JPG images').toMatch(/image\/\*|png/i);

    /* Cancel leaves the account untouched. */
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: 'Signatures' })).toHaveText(signaturesBefore ?? '');
  });

  test('ACC-009 login & security shows the account’s own sign-in state', async ({ page }) => {
    const [me, usage] = await Promise.all([
      page.request.get(API.me).then((r) => r.json()),
      page.request.get(API.billingUsage).then((r) => r.json()),
    ]);
    await page.goto('/account/security');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { name: 'Settings · login and security' })).toBeVisible();

    const login = page.getByRole('group', { name: 'Login and security' });
    await expect(login.getByText(me.email, { exact: true })).toBeVisible();
    await expect(login.getByText('••••••••')).toBeVisible();
    await expect(login.getByRole('button', { name: 'Change' })).toBeVisible();
    /* Two-factor switch and wording follow the account's enrolment. */
    const mfa = login.getByRole('switch', { name: 'Two-factor authentication' });
    await expect(mfa).toHaveAttribute('aria-checked', String(Boolean(me.mfa_enrolled)));
    if (!me.mfa_enrolled) await expect(login.getByText(/^Not enrolled\./)).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Passkeys', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add passkey' })).toBeVisible();
    const sso = page.getByRole('region', { name: 'Single sign-on (SAML)' });
    if (!usage.features.sso_scim) {
      await expect(sso).toContainText('Not configured.');
      await expect(sso.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', /^mailto:support@esignpro\.net/);
    }

    /* This browser is listed exactly once, marked as "this device". */
    const devices = page.getByRole('region', { name: 'Authenticated devices and browsers' }).last();
    await expect(devices.getByRole('columnheader')).toHaveText(['Device', 'Last seen', 'IP address', 'Location', 'Actions']);
    await expect(devices.getByRole('row').filter({ hasText: 'this device' })).toHaveCount(1);
    await expect(devices.getByRole('row').filter({ hasText: 'this device' }).getByRole('button', { name: 'Sign out here' })).toBeVisible();

    /* Remembered browsers: every entry is still valid (remembered until a future date). */
    const remembered = page.getByRole('region', { name: 'Remembered browsers' }).last();
    await expect(remembered.getByRole('columnheader')).toHaveText(['Browser', 'Last used', 'IP address', 'Remembered until', 'Actions']);
    const rows = remembered.getByRole('row').filter({ has: page.getByRole('cell') });
    requireData((await rows.count()) > 0, 'no remembered browser (the trusted-device cookie the suite signs in with)');
    for (const row of await rows.all()) {
      const until = (await row.getByRole('cell').nth(3).innerText()).trim();
      expect(Date.parse(until.replace(',', '')), `"Remembered until ${until}" should be in the future`).toBeGreaterThan(Date.now());
      await expect(row.getByRole('button', { name: 'Forget' })).toBeVisible();
    }
  });

  test('lists notification preferences', async ({ page }) => {
    await page.goto('/account/notifications');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { name: 'Notifications & email' })).toBeVisible();
    for (const event of [
      'A document I sent is delivered',
      'A recipient views my document',
      'A recipient signs my document',
      'A document completes',
      'A recipient declines',
      'A document is about to expire',
      'A reminder is sent on my behalf',
      'Weekly activity summary',
    ]) {
      await expect(page.getByText(event, { exact: true })).toBeVisible();
    }
  });

  /* Change-plan / add-seat dialogs are covered once, in tests/billing/billing.spec.ts. */

  test('change password cannot continue without the current password @regression', async ({
    profilePage,
  }) => {
    await profilePage.goto();
    await profilePage.openChangePassword();
    const continueButton = profilePage.changePasswordDialog.getByRole('button', { name: 'Continue' });

    await expect(profilePage.currentPasswordInput).toHaveValue('');
    await expect(continueButton).toBeDisabled();

    await profilePage.currentPasswordInput.fill('x');
    await expect(continueButton).toBeEnabled();
    await profilePage.currentPasswordInput.fill('');
    await expect(continueButton).toBeDisabled();

    await profilePage.changePasswordDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(profilePage.changePasswordDialog).toBeHidden();
  });
});

/**
 * ACC-008 / BUG-41 — change-password validation and the server's rejection.
 *
 * The PATCH /api/proxy/auth/password request is answered by a MOCK in the browser and never
 * reaches the server: changing the shared account's password would sign out every session
 * and forget the trusted browser the suite signs in with. Whether the server itself verifies
 * the current password (UF-41) needs a disposable account and is not automated here.
 */
test.describe('Account · change password (server answer mocked)', () => {
  const REJECTION = 'Current password is incorrect.';
  let calls: { method: string; body: Record<string, unknown> }[] = [];

  test.beforeEach(async ({ page, profilePage }) => {
    calls = [];
    await page.route('**/api/proxy/auth/password', async (route) => {
      calls.push({ method: route.request().method(), body: route.request().postDataJSON() ?? {} });
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: REJECTION }) });
    });
    await profilePage.goto();
    await profilePage.openChangePassword();
  });

  const continueToNewPassword = async (dialog: import('@playwright/test').Locator) => {
    await dialog.getByRole('textbox', { name: 'Current password' }).fill('Mock-Current#0000');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    const input = dialog.getByRole('textbox', { name: 'New password' });
    await expect(input).toBeVisible();
    return input;
  };

  test('ACC-008 both steps validate input, send the current password, and report a rejection', async ({ profilePage, page }) => {
    const dialog = profilePage.changePasswordDialog;
    const submit = dialog.getByRole('button', { name: 'Change password' });
    const input = await continueToNewPassword(dialog);
    await expect(input).toHaveAttribute('type', 'password');
    await expect(dialog).toContainText('At least 8 characters');
    await expect(submit, 'an empty new password cannot be submitted').toBeDisabled();

    await input.fill('Mock-NewPass#2026');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole('status').filter({ hasText: `Password not changed · ${REJECTION}` }), 'the rejection is reported to the user').toBeVisible();
    expect(calls, 'exactly one change request, carrying the current password for re-authentication').toEqual([
      { method: 'PATCH', body: { current_password: 'Mock-Current#0000', password: 'Mock-NewPass#2026' } },
    ]);
  });

  test('BUG-41 change password enforces its stated minimum and keeps the dialog open on rejection', knownBug(KNOWN_BUGS.BUG41), async ({ profilePage }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const dialog = profilePage.changePasswordDialog;
    const submit = dialog.getByRole('button', { name: 'Change password' });
    const input = await continueToNewPassword(dialog);
    await input.fill('x');
    await expect.soft(submit, '"At least 8 characters": a 1-character password must not be submittable').toBeDisabled();
    await input.fill('Mock-NewPass#2026');
    await submit.click();
    await expect(dialog, 'a rejected change should keep the dialog open with the error inline').toBeVisible();
    await expect(dialog).toContainText(REJECTION);
  });
});
