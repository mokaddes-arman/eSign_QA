import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type ReportSection = 'My analytics' | 'All reports' | 'By document' | 'By template' | 'By recipient' | 'Custom report';

const RANGE_VALUES = {
  'Last 7 days': '7d',
  'Last 30 days': '30d',
  'Last quarter': '90d',
  'Last 12 months': '12m',
} as const;

export class ReportsPage extends BasePage {
  protected readonly path = '/reports';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Reports' });
  readonly analyticsHeading = this.page.getByRole('heading', { name: 'My Analytics' });
  readonly dateRangeSelect = this.page.getByLabel('Date range');
  readonly exportButton = this.page.getByRole('button', { name: 'Export report' });
  readonly metrics = this.page.getByText('Completion rate');
  readonly table = this.page.getByRole('table');

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  sectionLink(name: ReportSection) {
    /* The section list is rendered twice (sidebar + in-page nav). */
    return this.page.getByRole('link', { name, exact: true }).first();
  }

  metricCard(label: string) {
    return this.page.getByText(label, { exact: true }).locator('..');
  }

  async openSection(name: ReportSection): Promise<void> {
    const before = this.page.url();
    const link = this.sectionLink(name);
    await link.click();
    try {
      await expect(this.page).not.toHaveURL(before, { timeout: 5_000 });
    } catch {
      /* Click can land before hydration attaches the client router. */
      await this.settle();
      await link.click();
      await expect(this.page).not.toHaveURL(before, { timeout: 10_000 });
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * The select is an RSC-backed control: the value briefly reverts and only
   * sticks once the `?range=` round-trip completes. Wait for the navigation
   * instead of re-selecting immediately, which would abort the transition.
   */
  async selectRange(label: 'Last 7 days' | 'Last 30 days' | 'Last quarter' | 'Last 12 months'): Promise<void> {
    const value = RANGE_VALUES[label];
    const committed = new RegExp(`[?&]range=${value}(?:&|$)`);

    await this.dateRangeSelect.selectOption({ label });
    try {
      await expect(this.page).toHaveURL(committed, { timeout: 15_000 });
    } catch {
      /* The change can land before the client listener is attached; retry once. */
      await this.dateRangeSelect.selectOption({ label });
      await expect(this.page).toHaveURL(committed, { timeout: 15_000 });
    }
    await expect(this.dateRangeSelect).toHaveValue(value, { timeout: 10_000 });
  }

  rowForRecipient(name: string) {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') });
  }
}
