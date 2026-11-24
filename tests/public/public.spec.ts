import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';

/* Public surfaces are guest-only: never reuse the saved session. */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Public site', () => {
  test('landing page renders hero, pricing and sign-in entry points @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/eSignPro/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Electronic Signatures/i);
    /* The header renders a desktop and a phone variant; one is display:none, so pick the visible one.
       On phones "Log in" lives in the hamburger menu (<details>), so open it first. */
    const logIn = page.getByRole('link', { name: /log in|sign in/i }).filter({ visible: true }).first();
    if (!(await logIn.isVisible().catch(() => false))) {
      await page.locator('header summary').filter({ visible: true }).first().click();
    }
    await expect(logIn).toBeVisible();
    await expect(page.getByRole('link', { name: /start free/i }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free', exact: true }).first()).toBeVisible();
  });

  test('pricing page lists every plan', async ({ page }) => {
    await page.goto('/pricing');
    for (const plan of ['Free', 'Team', 'Business', 'Enterprise']) {
      await expect(page.getByRole('heading', { name: plan, exact: true }).first()).toBeVisible();
    }
  });

  for (const [route, heading] of [
    /* The hero's accessible name lacks a space ("eSignProhandles") — see FEATURES O8. */
    ['/trust', /handles your documents/i],
    ['/verify', /Document verification/i],
    ['/security', /Security throughout/i],
    ['/legal', /The terms we work under/i],
    ['/changelog', /^Changelog$/],
  ] as const) {
    test(`${route} renders`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    });
  }

  test('AUTH-017 forgot-password validates the address and answers without revealing accounts', async ({ page }) => {
    await page.goto('/login/forgot');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
    const email = page.getByRole('textbox', { name: 'Work email' });
    const send = page.getByRole('button', { name: 'Send reset link' });
    const confirmation = page.getByRole('status').filter({ hasText: 'Check your inbox' });

    /* A malformed address is stopped by the e-mail field itself: nothing is sent. */
    await email.fill('not-an-email');
    await send.click();
    expect(await email.evaluate((el) => (el as HTMLInputElement).validity.valid), 'a malformed address must fail validation').toBe(false);
    await expect(confirmation).toHaveCount(0);

    /* An address with no account gets the same neutral answer a real one would (no account enumeration). */
    const nobody = `qa.nobody+${Date.now()}@example.com`;
    await email.fill(nobody);
    await clickUntilVisible(send, confirmation, { what: 'No confirmation after "Send reset link"' });
    await expect(confirmation).toContainText(`If an account exists for ${nobody}`);
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('BUG-35 reset-link lifetime is the same before and after sending', knownBug(KNOWN_BUGS.BUG35), async ({ page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await page.goto('/login/forgot');
    await waitForHydration(page);
    const minutes = (text: string) => Number(text.match(/(\d+) minutes/)?.[1]);
    const promised = minutes(await page.getByRole('region', { name: 'Reset your password' }).getByRole('paragraph').first().innerText());
    expect(promised, 'the page should state how long the link is valid').toBeGreaterThan(0);
    await page.getByRole('textbox', { name: 'Work email' }).fill(`qa.nobody+${Date.now()}@example.com`);
    const confirmation = page.getByRole('status').filter({ hasText: 'Check your inbox' });
    await clickUntilVisible(page.getByRole('button', { name: 'Send reset link' }), confirmation, { what: 'No confirmation after "Send reset link"' });
    expect(minutes(await confirmation.innerText()), `the form promised ${promised} minutes`).toBe(promised);
  });

  test('unknown routes send guests to sign in (404 is shown only when signed in)', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/login\?next=%2Fthis-route-does-not-exist/);
  });
});

test.describe('Access control', () => {
  for (const route of ['/overview', '/documents', '/account/security', '/reports']) {
    test(`guest is redirected from ${route} to login with next= @smoke`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}`));
      await expect(page.getByRole('heading', { name: 'Sign in to eSignPro' })).toBeVisible();
    });
  }
});
