/**
 * Interactive sign-up helper.
 *
 *   npm run signup
 *
 * Creates the workspace from .env, completes e-mail verification
 * (OTP_CODE / Gmail IMAP / terminal prompt) and stores the authenticated
 * session in auth/storageState.json so tests can reuse it.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/config/env';
import { registerUser } from '../src/helpers/authFlow';

async function main() {
  const outPath = path.resolve(process.cwd(), env.authStatePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await registerUser(page, {
      name: env.user.name,
      company: env.user.company,
      email: env.user.email,
      password: env.user.password,
      companyType: env.user.companyType,
      companySize: env.user.companySize,
    });

    console.log(`\nSigned in. Final URL: ${page.url()}`);
    await context.storageState({ path: outPath });
    console.log(`Session saved to ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
