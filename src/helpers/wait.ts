import type { Page } from '@playwright/test';

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
 * Waits until client components have hydrated.
 *
 * The app server-renders its markup, so `domcontentloaded` fires while the
 * page is visible but React has not attached its handlers yet. Clicks and
 * file selections made in that window are silently dropped. Hydration runs
 * as soon as the JS bundles execute, so a quiet network is a reliable proxy
 * for "interactive". The timeout is best-effort: pages that keep a socket
 * open should still be usable once hydration has finished.
 */
export async function waitForHydration(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
}
