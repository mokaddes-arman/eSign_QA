import fs from 'node:fs';
import { test, expect } from '../../src/fixtures/test';
import { env } from '../../src/config/env';
import { LoginPage } from '../../src/pages/LoginPage';

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
     every other test uses. Opt-in, run on its own, and it saves the new session back. */
  test('UF-05 guest deep link returns to the page after sign-in @flow', async ({ browser, baseURL }) => {
    test.skip(
      process.env.RUN_LOGIN_FLOW !== 'true',
      'Signs in and supersedes the shared session. Run alone: RUN_LOGIN_FLOW=true npx playwright test tests/flows/guest.flow.spec.ts',
    );
    test.skip(!process.env.ESIGN_EMAIL || !process.env.ESIGN_PASSWORD, 'Needs ESIGN_EMAIL / ESIGN_PASSWORD');
    test.skip(!fs.existsSync(env.authStatePath), 'Needs a saved session for the trusted-device cookie');

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
        test.skip(/\/login\/verify/.test(page.url()), 'Device not trusted: OTP required');
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
