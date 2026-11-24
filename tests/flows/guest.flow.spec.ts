import fs from 'node:fs';
import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { env } from '../../src/config/env';
import { LoginPage } from '../../src/pages/LoginPage';

/**
 * SEC-022 — the account allows ONE active session: a new sign-in signs the previous one out
 * (it is redirected to /login?reason=superseded on its next page). Runs in `chromium-account`;
 * the new session is saved back so the rest of the run stays signed in.
 */
test.describe('Security · single active session', () => {
  test('SEC-022 a new sign-in signs out the previous session @security', async ({ browser, baseURL }) => {
    requireEnv('ESIGN_EMAIL', 'sign in');
    requireEnv('ESIGN_PASSWORD', 'sign in');
    requireData(fs.existsSync(env.authStatePath), 'no saved session file (run npm run auth:save)');
    const saved = JSON.parse(fs.readFileSync(env.authStatePath, 'utf8'));
    const oldSession = await browser.newContext({ baseURL, storageState: saved });
    /* Only the trusted-device cookies, so the password login skips the e-mail OTP. */
    const newSession = await browser.newContext({ baseURL, storageState: { cookies: saved.cookies.filter((c: { name: string }) => c.name !== 'sf_session'), origins: [] } });
    try {
      const before = await oldSession.newPage();
      await before.goto('/overview', { waitUntil: 'domcontentloaded' });
      await expect(before.getByRole('heading', { level: 1, name: 'Overview' }), 'the saved session must be valid before the test').toBeVisible();

      const page = await newSession.newPage();
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      const login = new LoginPage(page);
      await login.waitForReady();
      await login.login(env.user.email, env.user.password);
      await page.waitForURL((u) => !/\/login$/.test(u.pathname), { timeout: 30_000 });
      requireData(!/\/login\/verify/.test(page.url()), 'the login asked for an e-mailed OTP: the trusted-device cookie has expired (run npm run auth:save)');
      await newSession.storageState({ path: env.authStatePath });

      /* The old session is ended server-side: its next request lands on the sign-in page, saying why. */
      await before.goto('/documents', { waitUntil: 'domcontentloaded' });
      await expect(before, 'the previous session should be signed out by the new sign-in').toHaveURL(/\/login\?.*reason=superseded/, { timeout: 20_000 });
      expect((await before.request.get('/api/proxy/me', { maxRedirects: 0 })).status(), 'the old session cookie must no longer authenticate API calls').not.toBe(200);
      /* The new session works. */
      await page.goto('/documents', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible();
    } finally {
      await oldSession.close();
      await newSession.close();
    }
  });
});

/** UF-01, UF-05 — journeys that start signed-out. */
test.describe('Flow · Guest journeys', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('UF-01 visitor picks a plan and lands on registration with it @flow', async ({ page }) => {
    await test.step('landing page', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    let planHref = '';
    await test.step('pricing lists the plans', async () => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      for (const plan of ['Free', 'Team', 'Business', 'Enterprise']) {
        await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
      }
      const cta = page.locator('a[href*="/register?plan="]').first();
      await expect(cta).toBeVisible();
      planHref = (await cta.getAttribute('href')) ?? '';
      await cta.click();
    });

    await test.step('registration keeps the chosen plan', async () => {
      const plan = new URL(planHref, 'https://x').searchParams.get('plan');
      await expect(page).toHaveURL(new RegExp(`/register\\?.*plan=${plan}`));
      await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible();
    });
  });

  /* The account allows ONE active session: signing in here signs out the saved session
     every other test uses. It therefore runs in the serial `chromium-account` project after
     every other Chromium test, saves the new session back, and the session-restore
     teardown re-validates it afterwards. */
  test('UF-05 guest deep link returns to the page after sign-in @flow', async ({ browser, baseURL }) => {
    requireEnv('ESIGN_EMAIL', 'sign in');
    requireEnv('ESIGN_PASSWORD', 'sign in');
    requireData(fs.existsSync(env.authStatePath), 'no saved session file: its trusted-device cookie lets the login skip the e-mail OTP (run npm run auth:save)');

    /* Keep only the trusted-device cookies so the password login skips the e-mail OTP. */
    const saved = JSON.parse(fs.readFileSync(env.authStatePath, 'utf8'));
    const cookies = saved.cookies.filter((c: { name: string }) => c.name !== 'sf_session');
    const context = await browser.newContext({ baseURL, storageState: { cookies, origins: [] } });
    const page = await context.newPage();
    try {
      await test.step('protected page redirects to login with next', async () => {
        await page.goto('/contacts', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/login\?next=%2Fcontacts/);
      });

      await test.step('sign in and land on the requested page', async () => {
        const login = new LoginPage(page);
        await login.waitForReady();
        await login.login(env.user.email, env.user.password);
        await page.waitForURL((u) => !/\/login$/.test(u.pathname), { timeout: 30_000 });
        requireData(!/\/login\/verify/.test(page.url()), 'the login asked for an e-mailed OTP: the trusted-device cookie has expired (run npm run auth:save)');
        await expect(page).toHaveURL(/\/contacts/);
        await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
        /* Keep the suite usable: this login replaced the saved session. */
        await context.storageState({ path: env.authStatePath });
      });
    } finally {
      await context.close();
    }
  });
});
