import { test, expect } from '../../src/fixtures/test';
import { env } from '../../src/config/env';

/* Registration is a guest-only surface: never reuse the saved session. */
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Public authentication coverage that does not require a live mailbox.
 * A real end-to-end signup runs only when RUN_SIGNUP=true, because every
 * execution creates a new workspace and sends a verification e-mail.
 */
test.describe('Authentication · registration form', () => {
  test.beforeEach(async ({ registerPage }) => {
    await registerPage.goto();
  });

  test('renders the create-account form with all required fields @smoke', async ({
    registerPage,
  }) => {
    await expect(registerPage.heading).toBeVisible();
    await expect(registerPage.fullNameInput).toBeVisible();
    await expect(registerPage.companyInput).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.companyTypeSelect).toBeVisible();
    await expect(registerPage.companySizeSelect).toBeVisible();
    await expect(registerPage.createAccountButton).toBeVisible();
  });

  test('blocks submission when the form is empty @regression', async ({ registerPage }) => {
    await registerPage.submit();
    await expect(registerPage.page).toHaveURL(/\/register/);
    await expect(registerPage.formStatus).toHaveText(/Name and company are required/i);
  });

  test('password strength meter reacts to the password @regression', async ({
    registerPage,
  }) => {
    await registerPage.passwordInput.fill('abc');
    await expect(registerPage.passwordHint).toHaveText(
      /Use 12\+ characters with a number, capital and symbol/i,
    );

    await registerPage.passwordInput.fill(env.user.password);
    await expect(registerPage.passwordHint).toHaveText(/Strong|Excellent/i);
  });

  test('requires accepting the terms before creating an account @regression', async ({
    registerPage,
  }, testInfo) => {
    await registerPage.fillForm({
      name: env.user.name,
      company: env.user.company,
      email: env.user.email,
      password: env.user.password,
      companyType: env.user.companyType,
      companySize: env.user.companySize,
    });
    await registerPage.termsCheckbox.uncheck();
    await registerPage.submit();

    await expect(registerPage.page).toHaveURL(/\/register/);
    await expect(registerPage.formStatus).toHaveText(/Accept the terms and disclosure/i);
    await testInfo.attach('register-url', {
      body: registerPage.page.url(),
      contentType: 'text/plain',
    });
  });

  test('can switch to the sign-in tab @smoke', async ({ registerPage }) => {
    await registerPage.signInTab.click();
    await expect(registerPage.page).toHaveURL(/\/login/);
  });
});

test.describe('Authentication · live signup', () => {
  test.skip(
    process.env.RUN_SIGNUP !== 'true',
    'Set RUN_SIGNUP=true to create a real workspace (sends a verification e-mail).',
  );

  test('creates a workspace and reaches the verification step', async ({
    registerPage,
    page,
  }) => {
    const uniqueEmail = env.user.email.replace('@', `+${Date.now()}@`);
    await registerPage.goto();
    await registerPage.fillForm({
      name: env.user.name,
      company: env.user.company,
      email: uniqueEmail,
      password: env.user.password,
      companyType: env.user.companyType,
      companySize: env.user.companySize,
    });
    await registerPage.submit();
    await expect(page).toHaveURL(/\/login\/verify/);
  });
});
