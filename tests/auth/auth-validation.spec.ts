import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/* Guest-only surfaces: never reuse the saved session. */
test.use({ storageState: { cookies: [], origins: [] } });

/*
 * Boundary and negative validation for registration, sign-in and password reset.
 * SAFETY: every non-GET request is aborted, so a validation gap can never create a
 * real workspace on the live site; an attempted submit is recorded as evidence.
 * Cases AUTH-025…AUTH-032 (docs/TEST_CASES.md §1).
 */
function blockWrites(page: Page): string[] {
  const attempted: string[] = [];
  void page.route('**/*', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.method() === 'HEAD') return route.continue();
    attempted.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.abort();
  });
  return attempted;
}

const VALID = { name: 'QA Boundary', company: 'QA Co', password: 'Str0ng!Boundary#26' };

test.describe('Authentication · registration validation', () => {
  test('AUTH-025 malformed e-mail is rejected before an account is created', async ({ registerPage, page }) => {
    const attempted = blockWrites(page);
    await registerPage.goto();
    await registerPage.fullNameInput.fill(VALID.name);
    await registerPage.companyInput.fill(VALID.company);
    await registerPage.emailInput.fill('not-an-email');
    await registerPage.passwordInput.fill(VALID.password);
    await registerPage.termsCheckbox.check();
    await registerPage.createAccountButton.click();
    await page.waitForTimeout(1_000);

    await expect(page).toHaveURL(/\/register/);
    const nativeInvalid = !(await registerPage.emailInput.evaluate((el: HTMLInputElement) => el.checkValidity()));
    const message = await registerPage.formStatus.innerText().catch(() => '');
    expect(nativeInvalid || /e-?mail/i.test(message), `no e-mail validation (status: "${message}")`).toBe(true);
    expect(attempted, 'invalid e-mail should be caught before submitting').toEqual([]);
  });

  /* The meter shows one of: "Use 12+ characters…" (hint), "Strong", "Excellent — meets…" (policy met). */
  const meter = (page: Page) => page.getByText(/^(Use 12\+ characters.*|Weak|Fair|Strong|Excellent.*)$/i).first();

  test('AUTH-026 password length boundary: 12 characters meets the policy', async ({ registerPage, page }) => {
    await registerPage.goto();
    await registerPage.passwordInput.fill('Abcdefgh1!xy'); /* 12 chars, every class */
    await expect(meter(page)).toHaveText(/^Excellent/i);
  });

  test('AUTH-026 BUG-21 password length boundary: 11 characters is not rated Strong', knownBug(KNOWN_BUGS.BUG21), async ({ registerPage, page }) => {
    expectOpenBugsToFail();
    const attempted = blockWrites(page);
    await registerPage.goto();
    await registerPage.passwordInput.fill('Abcdefgh1!x'); /* 11 chars, every class */
    await expect(meter(page)).toBeVisible();
    const label = (await meter(page).innerText()).trim();
    /* Evidence only: would the client submit a non-compliant password? (writes are aborted) */
    await registerPage.fullNameInput.fill(VALID.name);
    await registerPage.companyInput.fill(VALID.company);
    await registerPage.emailInput.fill(`qa.eleven.${Date.now()}@example.com`);
    await registerPage.termsCheckbox.check();
    await registerPage.createAccountButton.click();
    await page.waitForTimeout(1_000);
    test.info().annotations.push({ type: 'evidence', description: `11-char meter label "${label}"; client submit attempted: ${attempted.length > 0}` });
    expect(label, 'an 11-character password must not be labelled Strong/Excellent').toMatch(/Use 12\+ characters/i);
  });

  for (const [label, pwd] of [
    ['no digit', 'Abcdefghijk!xy'],
    ['no capital', 'abcdefgh1!xyzq'],
    ['no symbol', 'Abcdefgh1xyzqw'],
  ] as const) {
    test(`AUTH-027 BUG-21 password with ${label} is not rated Strong`, knownBug(KNOWN_BUGS.BUG21), async ({ registerPage, page }) => {
      expectOpenBugsToFail();
      await registerPage.goto();
      await registerPage.passwordInput.fill(pwd);
      await expect(meter(page)).toBeVisible();
      await expect(meter(page)).not.toHaveText(/^(Strong|Excellent)/i);
    });
  }

  test('AUTH-028 a weak password blocks account creation', async ({ registerPage, page }) => {
    const attempted = blockWrites(page);
    await registerPage.goto();
    await registerPage.fullNameInput.fill(VALID.name);
    await registerPage.companyInput.fill(VALID.company);
    await registerPage.emailInput.fill(`qa.weak.${Date.now()}@example.com`);
    await registerPage.passwordInput.fill('abc12345');
    await registerPage.termsCheckbox.check();
    await registerPage.createAccountButton.click();
    await page.waitForTimeout(1_000);

    await expect(page).toHaveURL(/\/register/);
    await expect(registerPage.formStatus).toHaveText(/password|12\+|characters|stronger/i);
    expect(attempted, 'weak password should be caught before submitting').toEqual([]);
  });

  test('AUTH-029 whitespace-only name and company count as empty', async ({ registerPage, page }) => {
    const attempted = blockWrites(page);
    await registerPage.goto();
    await registerPage.fullNameInput.fill('   ');
    await registerPage.companyInput.fill('   ');
    await registerPage.emailInput.fill(`qa.space.${Date.now()}@example.com`);
    await registerPage.passwordInput.fill(VALID.password);
    await registerPage.termsCheckbox.check();
    await registerPage.createAccountButton.click();
    await page.waitForTimeout(1_000);

    await expect(page).toHaveURL(/\/register/);
    await expect(registerPage.formStatus).toHaveText(/Name and company are required/i);
    expect(attempted).toEqual([]);
  });
});

test.describe('Authentication · sign-in & reset validation', () => {
  test('AUTH-030 sign-in with a malformed e-mail does not submit', async ({ loginPage, page }) => {
    const attempted = blockWrites(page);
    await loginPage.goto();
    await loginPage.emailInput.fill('not-an-email');
    await loginPage.passwordInput.fill('whatever-password');
    await loginPage.signInButton.click();
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/login/);
    const nativeInvalid = !(await loginPage.emailInput.evaluate((el: HTMLInputElement) => el.checkValidity()));
    const shown = await page.getByText(/valid e-?mail|enter an e-?mail|e-?mail address/i).count();
    expect(nativeInvalid || shown > 0, 'malformed e-mail is flagged').toBe(true);
    expect(attempted, 'malformed e-mail must not reach the server').toEqual([]);
  });

  test('AUTH-031 password-reset with a malformed e-mail is blocked', async ({ page }) => {
    const attempted = blockWrites(page);
    await page.goto('/login/forgot');
    const email = page.getByRole('textbox', { name: 'Work email' });
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/login\/forgot/);
    expect(await email.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    expect(attempted).toEqual([]);
  });

  test('AUTH-032 over-long e-mail (255+ chars) is handled without a crash', async ({ loginPage, page }) => {
    const attempted = blockWrites(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loginPage.goto();
    await loginPage.emailInput.fill(`${'a'.repeat(250)}@example.com`);
    await loginPage.passwordInput.fill('whatever-password');
    await loginPage.signInButton.click();
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.emailInput).toBeVisible();
    expect(errors, 'no uncaught script errors').toEqual([]);
    test.info().annotations.push({ type: 'note', description: `submit attempted: ${attempted.length > 0}` });
  });
});
