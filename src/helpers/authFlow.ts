import { expect, type Page } from '@playwright/test';
import { env, type TestUser } from '../config/env';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { fetchOtpFromGmail, promptForOtp } from './otp';
import { createLogger } from './logger';

const log = createLogger('auth');

/**
 * Resolves the 6-digit verification code in priority order:
 *   1. OTP_CODE from .env (deterministic for CI or local runs)
 *   2. newest code from the Gmail inbox (requires GMAIL_USER/GMAIL_APP_PASSWORD)
 *   3. interactive prompt (local headed runs only)
 */
export async function resolveOtp(): Promise<string> {
  if (env.otpCode) {
    log.info('Using OTP_CODE from environment');
    return env.otpCode;
  }
  if (env.gmail.configured) {
    return fetchOtpFromGmail();
  }
  if (process.env.CI) {
    throw new Error('OTP_CODE must be provided in CI (no interactive terminal)');
  }
  return promptForOtp();
}

/** Completes the /login/verify step when the app asks for it. */
export async function completeVerification(page: Page, code?: string): Promise<void> {
  if (!/\/login\/verify/.test(page.url())) return;

  const verifyPage = new VerifyEmailPage(page);
  await verifyPage.waitForReady();

  const otp = code ?? (await resolveOtp());
  log.info(`Submitting verification code ${otp}`);
  await verifyPage.submitCode(otp);

  await expect(page).not.toHaveURL(/\/login\/verify/, { timeout: 30_000 });
}

/** Creates a new workspace through /register and stops after verification. */
export async function registerUser(page: Page, user: TestUser, otp?: string): Promise<void> {
  const registerPage = new RegisterPage(page);
  await registerPage.goto();
  await registerPage.fillForm(user);
  await registerPage.submit();

  await expect(page).toHaveURL(/\/login\/verify/, { timeout: 30_000 });
  log.info('Account created, e-mail verification requested');
  await completeVerification(page, otp);
}

/** Signs in with email + password (MFA handled when prompted). */
export async function loginUser(page: Page, email: string, password: string, otp?: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  await page.waitForLoadState('domcontentloaded');

  if (/\/login\/verify/.test(page.url())) {
    await completeVerification(page, otp);
  }

  await expect(page).not.toHaveURL(/\/(login|register)(\/verify)?$/, { timeout: 30_000 });
  log.info(`Signed in as ${email}`);
}
