/**
 * Complete run, in the only safe order for an account with ONE active session:
 *
 *   1. Chromium — chromium (parallel) + chromium-builder (serial, shared draft).
 *   2. Account journeys — payments, uploads, performance, sign-in / sign-out, one at a
 *      time in `chromium-account`, then the session-restore teardown. Separate step so a
 *      failing known-bug test in step 1 can never stop it from running.
 *   3. Cross-browser smoke — Firefox, WebKit, Pixel 7 (after the session is restored).
 *
 * Each step archives its reports and regenerates qa-reports/ automatically
 * (reporters/qa-reports-reporter.ts). Exit code is non-zero if any step failed.
 *
 *   npm run test:all
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['Chromium (full suite)', ['playwright', 'test', '--project=chromium', '--project=chromium-builder']],
  ['Account journeys (serial) + session restore', ['playwright', 'test', '--project=chromium-account']],
  ['Cross-browser smoke', ['playwright', 'test', '--project=firefox', '--project=webkit', '--project=mobile-chrome', '--grep', '@smoke', '--workers=2']],
];

let failed = false;
for (const [label, args] of steps) {
  console.log(`\n=== ${label} ===`);
  const run = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
