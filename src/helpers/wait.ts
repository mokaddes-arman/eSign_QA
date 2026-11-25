import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Polls `probe` until it returns a truthy value or the timeout elapses.
 * Useful for UI states that do not expose a reliable waitFor selector.
 */
export async function waitForCondition<T>(
  probe: () => Promise<T | null | undefined | false>,
  options: { timeout?: number; interval?: number; message?: string } = {},
): Promise<T> {
  const { timeout = 15_000, interval = 250, message = 'condition' } = options;
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Timed out after ${timeout}ms waiting for ${message}` +
      (lastError ? `: ${(lastError as Error).message}` : ''),
  );
}

/** Small random pause to avoid hammering the UI in visual flows. */
export async function humanPause(page: Page, ms = 250): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Clicks `trigger` until `expected` is visible (TEST_PLAN R3).
 *
 * Under backend latency, and with trace/video recording on, a click can land
 * before React has attached its handler and is silently dropped — the page looks
 * ready but the dialog/menu never opens. Re-clicking only while the expected UI
 * is absent makes the action reliable without double-toggling stateful controls.
 */
export async function clickUntilVisible(
  trigger: Locator,
  expected: Locator,
  options: { timeout?: number; attemptTimeout?: number; what?: string } = {},
): Promise<void> {
  const { timeout = 20_000, attemptTimeout = 3_000, what } = options;
  const message = what ?? `Clicking ${trigger} did not show ${expected}`;
  await expect(async () => {
    if (!(await expected.isVisible().catch(() => false))) await trigger.click();
    await expect(expected, message).toBeVisible({ timeout: attemptTimeout });
  }, message).toPass({ timeout });
}

/**
 * Waits until client components have hydrated.
 *
 * The app server-renders its markup, so `domcontentloaded` fires while the
 * page is visible but React has not attached its handlers yet. Clicks made in
 * that window are silently dropped, and text typed into a controlled input is
 * shown but never reaches React state — the next re-render wipes it (AUTH-003
 * on CI WebKit: "Full name" emptied when "Company" was filled 80 ms later).
 *
 * A quiet network is not enough: the bundles finish downloading well before
 * they finish executing (≈0.5–0.75 s on the register page in WebKit). So after
 * `networkidle`, wait until React has claimed every form control on the page —
 * hydration stamps each host element with a `__reactProps$<id>` property.
 * `getOwnPropertyNames` is required: WebKit leaves these out of `Object.keys`.
 *
 * Both waits are best-effort: a page that keeps a socket open, or renders a
 * control outside React, falls through after the timeout instead of failing.
 */
export async function waitForHydration(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('input, select, textarea, button')).every((el) =>
          Object.getOwnPropertyNames(el).some((key) => key.startsWith('__reactProps$')),
        ),
      undefined,
      { timeout },
    )
    .catch(() =>
      console.warn(`[hydration] ${page.url()}: React had not claimed every form control after ${timeout}ms — continuing`),
    );
}
