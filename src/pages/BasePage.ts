import { expect, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from '../helpers/wait';

/**
 * Shared behaviour for every page object: navigation, waits,
 * common assertions and light-weight action helpers.
 */
export abstract class BasePage {
  protected abstract readonly path: string;

  constructor(public readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
    await this.settle();
    await this.waitForReady();
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
