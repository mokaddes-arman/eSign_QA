import { test, expect } from '../../src/fixtures/test';

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
    test.skip(!process.env.ESIGN_EMAIL, 'ESIGN_EMAIL is not set');
    await loginPage.emailInput.fill(process.env.ESIGN_EMAIL!);
    await loginPage.passwordInput.fill('Definitely-Wrong-Password1!');
    await loginPage.signInButton.click();

    await expect(
      page.getByText(/invalid|incorrect|wrong|check your/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('empty login submit stays on login @regression', async ({ loginPage, page }) => {
    await loginPage.signInButton.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
