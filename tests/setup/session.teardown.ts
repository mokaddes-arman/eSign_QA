import { test as teardown, expect } from '@playwright/test';
import { refreshSession } from '../../src/helpers/session';

/*
 * Teardown of the `chromium-account` project. Its tests sign in (UF-05) and sign out
 * (SESS-003), which ends the account's single shared session. This restores a valid
 * session in auth/storageState.json so later runs (and CI) keep working.
 */
teardown('restore the shared signed-in session', async () => {
  const { code, message } = await refreshSession();
  expect(code, message).toBe(0);
});
