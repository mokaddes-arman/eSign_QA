import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';

/* Sign-in is a guest-only surface: never reuse the saved session. */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication · login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('shows the sign-in form @smoke', async ({ loginPage }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
  });

  test('rejects an invalid password @regression', async ({ loginPage, page }) => {
    /* A real account e-mail with a wrong password; read from .env, never hard-coded. */
    requireEnv('ESIGN_EMAIL', 'try a wrong password on a real account');
    await loginPage.emailInput.fill(process.env.ESIGN_EMAIL!);
    await loginPage.passwordInput.fill('Definitely-Wrong-Password1!');
    await loginPage.signInButton.click();

    await expect(
      page.getByText(/invalid|incorrect|wrong|check your/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-014 empty login submit is blocked on the e-mail field @regression', async ({ loginPage, page }) => {
    await loginPage.signInButton.click();
    await expect(page).toHaveURL(/\/login/);
    /* Native required validation: the e-mail is flagged first and receives focus. */
    for (const input of [loginPage.emailInput, loginPage.passwordInput]) {
      expect(await input.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    }
    await expect(loginPage.emailInput).toBeFocused();
  });

  test('AUTH-024 sign-in explains SSO redirect and multi-factor protection', async ({ page }) => {
    await expect(page.getByText(/Enterprise tenants may be redirected to their identity provider/)).toBeVisible();
    await expect(page.getByText('Protected by multi-factor authentication')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Security controls' }).getByText('Multi-factor sign-in')).toBeVisible();
  });
});
