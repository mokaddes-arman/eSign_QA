import { request as playwrightRequest } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { API, FOREIGN_ID, READ_ENDPOINTS } from '../../src/helpers/api';
import { env } from '../../src/config/env';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/*
 * Light, non-destructive security checks (OWASP ASVS L1 / Top 10 smoke) against the
 * live deployment. GET requests and form validation only — nothing is created,
 * no brute force, no load. Case ids SEC-001…SEC-016 (docs/TEST_CASES.md §17).
 */
const XSS = `"><img src=x onerror="window.__xss=1">`;

test.describe('Security · transport & headers @security', () => {
  test('SEC-001 HTTP is redirected to HTTPS', async () => {
    const ctx = await playwrightRequest.newContext();
    const response = await ctx.get(env.baseUrl.replace(/^https:/, 'http:') + '/login', { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()['location']).toMatch(/^https:\/\//);
    await ctx.dispose();
  });

  for (const path of ['/', '/login', '/overview']) {
    test(`SEC-002 security headers are set on ${path} @smoke`, async ({ request }) => {
      const response = await request.get(path);
      const h = response.headers();
      const maxAge = Number(/max-age=(\d+)/.exec(h['strict-transport-security'] ?? '')?.[1] ?? 0);
      expect(maxAge, 'HSTS max-age ≥ 1 year').toBeGreaterThanOrEqual(31_536_000);
      expect(h['x-content-type-options']).toBe('nosniff');
      /* Clickjacking: either X-Frame-Options or CSP frame-ancestors. */
      expect(h['x-frame-options'] === 'DENY' || h['x-frame-options'] === 'SAMEORIGIN' || /frame-ancestors/.test(h['content-security-policy'] ?? '')).toBe(true);
      expect(h['content-security-policy'] ?? '', 'Content-Security-Policy').toMatch(/default-src 'self'/);
      expect(h['referrer-policy'] ?? '').toMatch(/strict-origin|no-referrer|same-origin/);
    });
  }

  test('SEC-003 BUG-22 responses do not disclose server software versions', knownBug(KNOWN_BUGS.BUG22), async ({ request }) => {
    expectOpenBugsToFail();
    const h = (await request.get('/login')).headers();
    expect(h['server'] ?? '', 'Server header reveals a version').not.toMatch(/\d+\.\d+/);
    expect(h['x-powered-by'], 'X-Powered-By header present').toBeUndefined();
  });

  test('SEC-004 session cookie is HttpOnly, Secure and SameSite', async ({ context, page }) => {
    await page.goto('/overview');
    const cookie = (await context.cookies()).find((c) => c.name === 'sf_session');
    expect(cookie, 'sf_session cookie').toBeDefined();
    expect(cookie!.httpOnly, 'HttpOnly (not readable by scripts)').toBe(true);
    expect(cookie!.secure, 'Secure (HTTPS only)').toBe(true);
    expect(['Lax', 'Strict']).toContain(cookie!.sameSite);
    expect(await page.evaluate(() => document.cookie), 'session id not exposed to JavaScript').not.toContain('sf_session');
  });
});

test.describe('Security · access control @security', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const url of READ_ENDPOINTS) {
    test(`SEC-005 anonymous ${url} returns no data`, async ({ request }) => {
      const response = await request.get(url, { maxRedirects: 0 });
      expect([302, 303, 307, 401, 403]).toContain(response.status());
      if (response.status() >= 300 && response.status() < 400) {
        /* Relative or absolute, but always this site's own login page (no open redirect). */
        const origin = new URL(env.baseUrl).origin.replace(/[.]/g, '\\.');
        expect(response.headers()['location']).toMatch(new RegExp(`^(${origin})?/login\\?next=`));
      }
      expect(await response.text(), 'no JSON payload leaked').not.toMatch(/"(id|email|organization_id)"\s*:/);
    });
  }

  for (const route of ['/contacts', '/reports', '/support', '/account/billing', `/documents/${FOREIGN_ID}/prepare`]) {
    test(`SEC-006 guest deep link ${route} redirects to sign in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole('heading', { name: 'Sign in to eSignPro' })).toBeVisible();
    });
  }
});

test.describe('Security · object access (IDOR) @security', () => {
  test('SEC-007 another tenant’s / unknown document is not readable via API or UI', async ({ request, page }) => {
    const api = await request.get(API.document(FOREIGN_ID));
    expect([403, 404]).toContain(api.status());

    const docRequests: number[] = [];
    page.on('response', (r) => { if (r.url().includes(`/api/proxy/documents/${FOREIGN_ID}`)) docRequests.push(r.status()); });
    await page.goto(`/documents/${FOREIGN_ID}/prepare`);
    await expect(page.getByText(/isn.t available|isn.t here|not found/i).first()).toBeVisible();
    /* No document content is rendered: no recipients panel, no placed fields, no page canvas. */
    await expect(page.getByRole('button', { name: /^Add recipient$/ })).toHaveCount(0);
    await expect(page.getByText(/\d+ fields? · autosaved/)).toHaveCount(0);
    expect(docRequests.filter((s) => s === 200), 'the browser never received the document').toEqual([]);
  });

  test('SEC-008 API payloads never include credentials or secrets', async ({ request }) => {
    for (const url of [API.me, API.documents, API.contacts, API.billingUsage]) {
      const text = await (await request.get(url)).text();
      expect(text, url).not.toMatch(/"(password|password_hash|hashed_password|secret|api_key|otp|totp_secret|reset_token)"\s*:/i);
      expect(text, url).not.toMatch(/\$2[aby]\$\d{2}\$|\$argon2/);
    }
  });
});

test.describe('Security · injection & redirects @security', () => {
  test('SEC-009 reflected XSS: document search query is rendered as text', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss(); });
    await page.goto(`/documents?q=${encodeURIComponent(XSS)}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count(), 'payload must not create an element').toBe(0);
    expect(dialogs).toEqual([]);
  });

  test('SEC-010 stored/reflected XSS: global search renders the payload as text', async ({ overviewPage, page }) => {
    await overviewPage.goto();
    const box = page.getByRole('combobox', { name: /search/i }).first();
    /* The shortcut is ignored until the shell has hydrated (TEST_PLAN R3): retry until the dialog opens. */
    await expect(async () => {
      if (!(await box.isVisible().catch(() => false))) await page.keyboard.press('Control+k');
      await expect(box).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await box.fill(XSS);
    await page.waitForTimeout(1_500);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await page.keyboard.press('Escape');
  });

  test('SEC-011 open redirect: next= cannot send a signed-in user off-site', async ({ page }) => {
    for (const next of ['https://evil.example.com/', '//evil.example.com', 'javascript:alert(1)']) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(new URL(page.url()).host, `next=${next}`).toBe(new URL(env.baseUrl).host);
    }
  });

  test('SEC-012 guest: next= is not reflected as an off-site link or script', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`/login?next=${encodeURIComponent('https://evil.example.com/' + XSS)}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    expect(await page.locator('a[href*="evil.example.com"], form[action*="evil.example.com"]').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await ctx.close();
  });
});

test.describe('Security · authentication hygiene @security', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SEC-013 login does not reveal whether an account exists', async ({ loginPage, page }) => {
    requireEnv('ESIGN_EMAIL', 'compare messages for a real and an unknown account');
    const messageFor = async (email: string) => {
      await loginPage.goto();
      await loginPage.login(email, 'Definitely-Wrong-Password1!');
      const msg = page.getByText(/invalid|incorrect|wrong|check your|not found|no account/i).first();
      await expect(msg).toBeVisible({ timeout: 15_000 });
      return (await msg.innerText()).trim();
    };
    const known = await messageFor(process.env.ESIGN_EMAIL!);
    const unknown = await messageFor(`qa.nobody.${Date.now()}@example.com`);
    expect(unknown, 'same generic message for unknown e-mail and wrong password').toBe(known);
  });

  test('SEC-014 password inputs are masked and use correct autocomplete', async ({ loginPage, registerPage, page }) => {
    await loginPage.goto();
    const loginPassword = page.locator('input[type="password"]');
    await expect(loginPassword).toHaveCount(1);
    await expect(loginPassword).toHaveAttribute('autocomplete', /current-password/);

    await registerPage.goto();
    const newPassword = page.locator('input[type="password"]');
    await expect(newPassword).toHaveCount(1);
    await expect(newPassword).toHaveAttribute('autocomplete', /new-password/);
  });

  test('SEC-015 forgot-password gives the same answer for unknown accounts', async ({ page }) => {
    await page.goto('/login/forgot');
    await page.getByRole('textbox', { name: 'Work email' }).fill(`qa.nobody.${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    /* Expected: a neutral "if an account exists…" confirmation, never "no such account". */
    await expect(page.getByText(/if .*account|check your (inbox|email)|we.ve sent|link (is )?on its way|sent/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/no account|not found|doesn.t exist|unknown (user|email)/i)).toHaveCount(0);
  });

  test('SEC-016 SQL/command meta-characters in login are handled as data', async ({ loginPage, page }) => {
    const responses: number[] = [];
    page.on('response', (r) => { if (r.request().method() === 'POST') responses.push(r.status()); });
    await loginPage.goto();
    await loginPage.emailInput.fill(`qa'--@example.com`);
    await loginPage.passwordInput.fill(`' OR '1'='1'; --`);
    await loginPage.signInButton.click();
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL(/\/login/);
    expect(responses.filter((s) => s >= 500), 'no 5xx for meta-characters').toEqual([]);
  });
});
