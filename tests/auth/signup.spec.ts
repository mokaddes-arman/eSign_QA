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

  test('AUTH-003 renders the create-account form with all required fields @smoke', async ({
    registerPage,
  }) => {
    await expect(registerPage.heading).toBeVisible();
    await expect(registerPage.createAccountButton).toBeVisible();

    /* Each field accepts input and keeps it; the browser gets the right hints to autofill. */
    const fields = [
      { input: registerPage.fullNameInput, value: 'QA Form Check', type: 'text', autocomplete: 'name' },
      { input: registerPage.companyInput, value: 'QA Form Ltd', type: 'text', autocomplete: 'organization' },
      { input: registerPage.emailInput, value: 'qa.form-check@example.com', type: 'email', autocomplete: 'email' },
      { input: registerPage.passwordInput, value: 'Form-Check#2026', type: 'password', autocomplete: 'new-password' },
    ];
    for (const { input, value, type, autocomplete } of fields) {
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('type', type);
      await expect(input).toHaveAttribute('autocomplete', autocomplete);
      await input.fill(value);
    }
    for (const { input, value } of fields) await expect(input).toHaveValue(value);

    /* The password is masked until the user reveals it, and the value survives the toggle. */
    await registerPage.showPasswordButton.click();
    await expect(registerPage.passwordInput).toHaveAttribute('type', 'text');
    await expect(registerPage.passwordInput).toHaveValue('Form-Check#2026');
    await expect(registerPage.companyTypeSelect).toBeVisible();
    await expect(registerPage.companySizeSelect).toBeVisible();
    await expect(registerPage.termsCheckbox).not.toBeChecked();
  });

  test('AUTH-007 company type and size list every option and keep the selection', async ({ registerPage }) => {
    const options = (select: typeof registerPage.companyTypeSelect) =>
      select.locator('option').evaluateAll((all) => all.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent?.trim(), disabled: (o as HTMLOptionElement).disabled })));

    expect(await options(registerPage.companyTypeSelect)).toEqual([
      { value: '', label: 'Choose an industry', disabled: true },
      { value: 'real-estate', label: 'Real estate', disabled: false },
      { value: 'mortgage', label: 'Mortgage and lending', disabled: false },
      { value: 'property-management', label: 'Property management', disabled: false },
      { value: 'insurance', label: 'Insurance', disabled: false },
      { value: 'professional-services', label: 'Professional services', disabled: false },
      { value: 'legal', label: 'Legal', disabled: false },
      { value: 'hr', label: 'HR and recruiting', disabled: false },
      { value: 'healthcare', label: 'Healthcare', disabled: false },
      { value: 'government', label: 'Government and public sector', disabled: false },
      { value: 'other', label: 'Other', disabled: false },
    ]);
    expect((await options(registerPage.companySizeSelect)).map((o) => o.label)).toEqual(['1–50', '51–500', '501–5,000', '5,000+']);

    await registerPage.companyTypeSelect.selectOption({ label: 'Legal' });
    await registerPage.companySizeSelect.selectOption({ label: '51–500' });
    /* Editing the rest of the form must not reset either choice. */
    await registerPage.fullNameInput.fill('QA Select Check');
    await registerPage.emailInput.fill('qa.select-check@example.com');
    await registerPage.termsCheckbox.check();
    await expect(registerPage.companyTypeSelect).toHaveValue('legal');
    await expect(registerPage.companySizeSelect).toHaveValue('51-500');
    await expect(registerPage.companyTypeSelect.locator('option:checked')).toHaveText('Legal');
    await expect(registerPage.companySizeSelect.locator('option:checked')).toHaveText('51–500');
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

    /* A literal that meets the 12+ policy — the account password in .env is shorter
       ("Almost — use 12+ characters"), and this case is about the meter, not the account. */
    await registerPage.passwordInput.fill('Meter-Check#2026x');
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

/* Runs every time (agreed 18 Nov 2026): each run registers a unique example.com address,
   so no real inbox receives the verification e-mail, and stops at the OTP page. It leaves
   one unverified workspace per run on the live site. */
test.describe('Authentication · live signup', () => {
  test('creates a workspace and reaches the verification step', async ({
    registerPage,
    page,
  }) => {
    const uniqueEmail = `qa.signup+${Date.now()}@example.com`;
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
    await expect(page, 'Registration did not reach the e-mail verification step').toHaveURL(/\/login\/verify/, { timeout: 30_000 });
    await expect(page.getByText(uniqueEmail).or(page.getByText(/code|verify/i)).first(), 'The verification page should ask for the e-mailed code').toBeVisible();
  });
});
