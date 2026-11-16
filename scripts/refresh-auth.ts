/**
 * Headless session refresh.
 *
 *   npm run auth:refresh
 *
 * The app session cookie (`sf_session`) lives ~12 h, but the trusted-device
 * cookie (`esp_device`, ~90 days) lets a password login skip the e-mail OTP.
 * This script reuses auth/storageState.json, and if the session has expired it
 * signs in again with .env credentials and rewrites the file. CI runs it before
 * the suite, so the AUTH_STORAGE_STATE_B64 secret only needs refreshing when the
 * device cookie itself expires (run `npm run auth:save` then).
 *
 * Exit codes: 0 = session valid, 2 = OTP required (device not trusted), 1 = error.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/config/env';
import { LoginPage } from '../src/pages/LoginPage';

async function main(): Promise<number> {
  if (!fs.existsSync(env.authStatePath)) {
    console.error(`No session file at ${env.authStatePath}. Run "npm run auth:save" first.`);
    return 1;
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
      console.log('Session still valid.');
      await context.storageState({ path: env.authStatePath });
      return 0;
    }

    console.log(`Session expired or superseded (${page.url()}) — signing in with the trusted device…`);
    const login = new LoginPage(page);
    await login.waitForReady();
    await login.login(env.user.email, env.user.password);
    await page.waitForURL((u) => !/\/login$/.test(u.pathname), { timeout: 30_000 });

    if (/\/login\/verify/.test(page.url())) {
      console.error('OTP required: this device is no longer trusted. Run "npm run auth:save" and update AUTH_STORAGE_STATE_B64.');
      return 2;
    }
    if (/\/login/.test(page.url())) {
      console.error('Login failed (still on /login). Check ESIGN_EMAIL / ESIGN_PASSWORD.');
      return 1;
    }

    await context.storageState({ path: env.authStatePath });
    console.log('Session refreshed.');
    return 0;
  } finally {
    await browser.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
