/**
 * Interactive login helper.
 *
 *   npm run auth:save
 *
 * Signs in with .env credentials, completes the e-mail OTP step and writes
 * the authenticated session to auth/storageState.json for headless test runs.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/config/env';
import { loginUser } from '../src/helpers/authFlow';

async function main() {
  const outPath = path.resolve(process.cwd(), env.authStatePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await loginUser(page, env.user.email, env.user.password);
    console.log(`\nSigned in. Final URL: ${page.url()}`);

    await context.storageState({ path: outPath });
    console.log(`Session saved to ${outPath}`);
    console.log('Headless tests will reuse this session automatically.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
