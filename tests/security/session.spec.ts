import fs from 'node:fs';
import { request as playwrightRequest } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { API } from '../../src/helpers/api';
import { env } from '../../src/config/env';

/*
 * Session management. SESS-001/002 work on a copy of the saved cookies and never
 * touch the real session. SESS-003 signs out, which ends the account's single
 * active session: it runs in the serial `chromium-account` project after every other
 * Chromium test, and the session-restore teardown signs back in afterwards.
 * Case ids: SESS-001…SESS-003 (NF-008, AUTH-019 in docs/TEST_CASES.md).
 */
test.describe('Security · session management @security', () => {
  test('SESS-001 losing the session cookie sends the user to sign in with next= (NF-008)', async ({ page, context }) => {
    await page.goto('/contacts');
    await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();

    await context.clearCookies();
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login\?next=%2Freports/);
  });

  test('SESS-002 a forged session cookie is rejected', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await ctx.addCookies([{ name: 'sf_session', value: 'forged-' + 'a'.repeat(40), domain: new URL(env.baseUrl).hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await ctx.newPage();
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login/);
    const api = await ctx.request.get(API.me, { maxRedirects: 0 });
    expect(api.status()).not.toBe(200);
    await ctx.close();
  });

  test('SESS-003 sign out ends the session server-side (AUTH-019) @signout', async ({ page, context, navigation }) => {
    requireData(fs.existsSync(env.authStatePath), 'no saved session file (run npm run auth:save)');

    await page.goto('/overview');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const before = (await context.cookies()).find((c) => c.name === 'sf_session');
    expect(before).toBeDefined();

    await navigation.signOutFromMenu();
    await expect(page).toHaveURL(/\/(login|$)|\/\?|esignpro\.net\/?$/, { timeout: 15_000 });

    /* Back button must not show the signed-in app again. */
    await page.goBack().catch(() => undefined);
    /* The app notices the revoked session and redirects to /login on its own; a reload
       during that redirect is aborted, so only reload if it stays on the app page. */
    try {
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    }

    /* Replaying the old cookie must not work: the session was revoked on the server. */
    const replay = await playwrightRequest.newContext({ baseURL: env.baseUrl, extraHTTPHeaders: { cookie: `sf_session=${before!.value}` } });
    const response = await replay.get(API.me, { maxRedirects: 0 });
    expect(response.status(), 'old session cookie still accepted after sign-out').not.toBe(200);
    await replay.dispose();
  });
});
