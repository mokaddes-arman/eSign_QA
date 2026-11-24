import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, knownBug, expectOpenBugsToFail } from '../../src/helpers/bugs';
import { expectErrorStyled } from '../../src/helpers/ui';
import { uiBaseline } from '../../src/helpers/uiSuite';

/** UI checks for sign-in, registration and password reset, as a guest. */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('UI · Authentication', () => {
  uiBaseline([
    { name: 'Login', path: '/login', ready: (p) => p.getByRole('textbox', { name: /email/i }) },
    { name: 'Register', path: '/register', ready: (p) => p.getByRole('heading', { name: 'Create your workspace' }) },
    { name: 'Forgot password', path: '/login/forgot', ready: (p) => p.getByRole('textbox', { name: /email/i }) },
  ]);

  test('password fields are masked and can be revealed', async ({ registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.passwordInput).toHaveAttribute('type', 'password');
    await registerPage.passwordInput.fill('Visible?123');
    await registerPage.showPasswordButton.click();
    await expect(registerPage.passwordInput).toHaveAttribute('type', 'text');
  });

  test('BUG-15 registration validation message is shown in the error colour', knownBug(KNOWN_BUGS.BUG15), async ({ registerPage }) => {
    expectOpenBugsToFail();
    await registerPage.goto();
    await registerPage.createAccountButton.click();
    const message = registerPage.page.getByText(/Name and company are required/);
    await expect(message).toBeVisible();
    await expectErrorStyled(message, 'registration validation message');
  });

  test('login error for wrong credentials is shown in the error colour', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.login('qa.nobody@example.com', 'definitely-wrong-Password1!');
    const error = page.getByText(/invalid|incorrect|wrong|not match/i).first();
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expectErrorStyled(error, 'login error');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login and register tabs reflect the current page', async ({ registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.createAccountTab).toHaveAttribute('aria-selected', 'true');
    await expect(registerPage.signInTab).toHaveAttribute('aria-selected', 'false');
  });
});
