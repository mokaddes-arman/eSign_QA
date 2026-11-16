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
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://esignpro.net',
    /* Reuse the authenticated session captured by `npm run auth:save` */
    storageState: hasAuthState ? AUTH_STATE : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: DRAFT_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      /* Specs that read or change the shared newest draft (fields, favourites, name,
         preview, workflow). Run them one at a time so they never race each other;
         every change is reverted in-test. Runs alongside the parallel `chromium` project. */
      name: 'chromium-builder',
      testMatch: DRAFT_SPECS,
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],

  outputDir: 'test-results',
});
