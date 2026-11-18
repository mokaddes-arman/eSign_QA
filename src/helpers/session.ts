import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../config/env';
import { LoginPage } from '../pages/LoginPage';

export type RefreshResult = { code: 0 | 1 | 2; message: string };

/**
 * Makes auth/storageState.json hold a valid signed-in session.
 *
 * The app allows ONE active session per account. `sf_session` lives ~12 h; the
 * trusted-device cookie `esp_device` (~90 days) lets a password login skip the OTP.
 * Used by `npm run auth:refresh` and by the `session-restore` teardown project that
 * runs after the session-ending tests (sign-in UF-05, sign-out SESS-003).
 *
 * Codes: 0 = valid/refreshed, 2 = OTP required (device not trusted), 1 = error.
 */
export async function refreshSession(): Promise<RefreshResult> {
  if (!fs.existsSync(env.authStatePath)) {
    return { code: 1, message: `No session file at ${env.authStatePath}. Run "npm run auth:save" first.` };
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: env.baseUrl, storageState: env.authStatePath });
  const page = await context.newPage();
  try {
    await page.goto('/overview', { waitUntil: 'domcontentloaded' });
    /* A superseded session (signed in elsewhere) is redirected client-side after load. */
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const onLogin = /\/login/.test(page.url()) || (await page.getByRole('heading', { name: /Sign in to eSignPro/ }).isVisible());
    if (!onLogin) {
      await context.storageState({ path: env.authStatePath });
      return { code: 0, message: 'Session still valid.' };
    }

    const login = new LoginPage(page);
    await login.waitForReady();
    await login.login(env.user.email, env.user.password);
    await page.waitForURL((u) => !/\/login$/.test(u.pathname), { timeout: 30_000 });

    if (/\/login\/verify/.test(page.url())) {
      return { code: 2, message: 'OTP required: this device is no longer trusted. Run "npm run auth:save" and update AUTH_STORAGE_STATE_B64.' };
    }
    if (/\/login/.test(page.url())) {
      return { code: 1, message: 'Login failed (still on /login). Check ESIGN_EMAIL / ESIGN_PASSWORD.' };
    }
    await context.storageState({ path: env.authStatePath });
    return { code: 0, message: 'Session refreshed.' };
  } finally {
    await browser.close();
  }
}
