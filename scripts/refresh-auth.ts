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
 * The logic lives in src/helpers/session.ts (shared with the session-restore teardown).
 */
import { refreshSession } from '../src/helpers/session';

refreshSession()
  .then(({ code, message }) => {
    (code === 0 ? console.log : console.error)(message);
    process.exit(code);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
