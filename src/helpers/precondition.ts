/**
 * Test-data preconditions.
 *
 * The suite never skips a case. When a test needs workspace data that is missing
 * (e.g. "at least two documents"), it FAILS with a message that says so plainly, so
 * a broken locator can never masquerade as "no data" and silently skip a check.
 * Conditions should be read from the API (src/helpers/api.ts), not from the UI.
 */
export function requireData(condition: unknown, what: string): asserts condition {
  if (!condition) {
    throw new Error(`Precondition failed (test data): ${what}`);
  }
}

/** Required configuration, e.g. a .env variable. */
export function requireEnv(name: string, purpose: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Precondition failed (configuration): ${name} is not set in .env — needed to ${purpose}.`);
  }
  return value;
}
