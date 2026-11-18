import { expect, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from '../helpers/wait';
import { heal } from '../helpers/selfHeal';

/**
 * Shared behaviour for every page object: navigation, waits,
 * common assertions and light-weight action helpers.
 */
export abstract class BasePage {
  protected abstract readonly path: string;

  constructor(public readonly page: Page) {}

  /**
   * Self-healing locator: the primary strategy, then fallbacks if the markup drifted.
   * Fallback use is reported after each test (annotation "self-healed").
   */
  protected heal(name: string, primary: Locator, ...fallbacks: Locator[]): Locator {
    return heal(this.page, name, primary, ...fallbacks);
  }

  /**
   * A button found by role, healing to an exact visible-text or aria-label/title match.
   * Fallbacks always match the WHOLE label, so they can only find the same control by
   * another route — `.or()` unions in DOM order, and a loose substring fallback could
   * otherwise pick an earlier, different button. `exact` applies to the primary only.
   */
  protected healButton(label: string, exact = true): Locator {
    const text = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    return this.heal(
      `button "${label}"`,
      this.page.getByRole('button', { name: label, exact }),
      this.page.locator('button, [role="button"]').filter({ hasText: text }),
      this.page.locator(`[aria-label="${label}"], [title="${label}"]`),
    );
  }

  async goto(): Promise<void> {
    /* A slow live site can time out a navigation; try once more before failing. */
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' }).catch(async (error: Error) => {
      if (!/Timeout|net::ERR_/.test(error.message)) throw error;
      console.warn(`[navigation] ${this.path}: ${error.message.split('\n')[0]} — retrying once`);
      await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
    });
    await this.settle();
    this.assertSessionNotSuperseded();
    await this.recoverFromApiOutage();
    await this.waitForReady();
  }

  /**
   * The account allows one active session: any new sign-in elsewhere (another
   * run, a teammate, `auth:save`) signs this one out with `?reason=superseded`.
   * Fail with an actionable message instead of a locator timeout.
   */
  assertSessionNotSuperseded(): void {
    if (/[?&]reason=superseded/.test(this.page.url())) {
      throw new Error(
        'Saved session was signed out because the account signed in elsewhere (single active session). ' +
          'Run "npm run auth:refresh" and avoid parallel runs against the same account.',
      );
    }
  }

  /** Banner the app renders when a backend call times out ("Can't reach the eSignPro API"). */
  get apiOutageAlert(): Locator {
    return this.page.getByRole('alert').filter({ hasText: /reach the eSignPro API/ });
  }

  /**
   * The backend occasionally times out under parallel load and the page then
   * renders stale/blank data behind an alert. Reload once so a transient
   * backend hiccup does not masquerade as a UI regression; a persistent
   * outage still fails the test on its own assertions.
   */
  async recoverFromApiOutage(): Promise<void> {
    if ((await this.apiOutageAlert.count()) === 0) return;
    console.warn(`[api-outage] ${this.page.url()} — reloading once`);
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.settle();
  }

  /**
   * Waits until client components have hydrated and can accept input.
   * Call this after any navigation that bypasses `goto()`.
   */
  async settle(): Promise<void> {
    await waitForHydration(this.page);
  }

  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('body')).toBeVisible();
  }

  async url(): Promise<string> {
    return this.page.url();
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  async expectUrlContains(fragment: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(fragment.replace(/[/.?]/g, '\\$&')));
  }

  async expectVisible(locator: Locator, description?: string): Promise<void> {
    await expect(locator, description).toBeVisible();
  }

  async expectHidden(locator: Locator, description?: string): Promise<void> {
    await expect(locator, description).toBeHidden();
  }

  async expectText(locator: Locator, text: string | RegExp): Promise<void> {
    await expect(locator).toContainText(text);
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  /** Text of the first visible toast/alert, if any. */
  async toastText(): Promise<string | null> {
    const toast = this.page
      .locator('[role="status"], [role="alert"], [data-sonner-toast], .toast')
      .filter({ hasNotText: /^\s*$/ })
      .last();
    if ((await toast.count()) === 0) return null;
    return (await toast.textContent())?.trim() ?? null;
  }

  /** Dismisses an open dialog if present (best effort). */
  async closeDialog(): Promise<void> {
    const close = this.page
      .getByRole('button', { name: /close|dismiss|cancel/i })
      .first();
    if (await close.isVisible().catch(() => false)) {
      await close.click({ trial: false }).catch(() => undefined);
    }
  }
}
