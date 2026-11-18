import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

export const AUTH_STATE = path.resolve(
  __dirname,
  process.env.AUTH_STATE_PATH || 'auth/storageState.json',
);

const hasAuthState = fs.existsSync(AUTH_STATE);

/** Specs that use the shared newest draft envelope (see project `chromium-builder`). */
const DRAFT_SPECS = [
  '**/bugs/**/*.spec.ts',
  '**/flows/envelope-preparation.flow.spec.ts',
  '**/flows/library.flow.spec.ts',
  '**/ui/prepare.ui.spec.ts',
  '**/ui/workflow.ui.spec.ts',
  '**/ui/signer.ui.spec.ts',
  '**/documents/prepare.spec.ts',
  '**/documents/builder-details.spec.ts',
  '**/signer/signer.spec.ts',
];

/**
 * Specs that change account-wide state: a Stripe test-mode plan change, saved cards,
 * new drafts (they become the "most recent draft" the builder specs reuse), and the
 * sign-in / sign-out journeys that end the account's single active session.
 * They run in `chromium-account` AFTER every other Chromium test, one at a time, and
 * the `session-restore` teardown signs back in afterwards. Chromium-only by design.
 */
const ACCOUNT_SPECS = [
  /* Timing budgets need a quiet browser: measured here, not alongside the parallel suite. */
  '**/performance/performance.spec.ts',
  '**/billing/payments.spec.ts',
  '**/documents/upload.spec.ts',
  '**/flows/guest.flow.spec.ts',
  '**/security/session.spec.ts',
];
const SETUP = '**/setup/**';

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    /* Test-health dashboard (Overview, Known bugs, Modules, Failures…). Opens in a
       new browser tab after a local run; never on CI. DASHBOARD_OPEN=never|always overrides. */
    ['./reporters/dashboard-reporter.ts', { outputFile: 'dashboard-report/index.html', open: 'auto' }],
    /* After every local run: archive the reports and regenerate qa-reports/ (dated).
       QA_REPORTS=off disables it. Runs in onExit, after all reports above are written. */
    ['./reporters/qa-reports-reporter.ts'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://esignpro.net',
    /* Reuse the authenticated session captured by `npm run auth:save` */
    storageState: hasAuthState ? AUTH_STATE : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    /* The live site exceeded 30 s for domcontentloaded 11 times in one full run under
       parallel load (18 Nov 2026); 60 s keeps those from failing as "timeouts". */
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: [...DRAFT_SPECS, ...ACCOUNT_SPECS, SETUP],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      /* Specs that read or change the shared newest draft (fields, favourites, name,
         preview, workflow). Run them one at a time so they never race each other;
         every change is reverted in-test. Runs alongside the parallel `chromium` project. */
      name: 'chromium-builder',
      testMatch: DRAFT_SPECS,
      /* The builder (canvas + fields) loads slowly on the live site; its hooks open it. */
      timeout: 120_000,
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      /* Account-wide state changes and session-ending journeys (see ACCOUNT_SPECS), one test
         at a time, then the `session-restore` teardown. Run it AFTER the other Chromium
         projects, in its own invocation — `npm run test:all` does that. (Not a project
         dependency: Playwright would not start it whenever a known-bug test failed.) */
      name: 'chromium-account',
      testMatch: ACCOUNT_SPECS,
      teardown: 'session-restore',
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      /* Signs back in after `chromium-account` ended the shared session. */
      name: 'session-restore',
      testMatch: '**/setup/session.teardown.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: [...ACCOUNT_SPECS, SETUP],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: [...ACCOUNT_SPECS, SETUP],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testIgnore: [...ACCOUNT_SPECS, SETUP],
      use: { ...devices['Pixel 7'] },
    },
  ],

  outputDir: 'test-results',
});
