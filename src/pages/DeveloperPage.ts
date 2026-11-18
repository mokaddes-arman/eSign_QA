import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DeveloperPage extends BasePage {
  protected readonly path = '/developer/api';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Developer API & add-on' });
  readonly startBuilding = this.page.getByRole('heading', { name: 'Start building' });
  readonly createKeyButton = this.healButton('Create key', false);
  readonly apiConsoleLink = this.page.getByRole('link', { name: 'API console' });
  readonly guidesLink = this.page.getByRole('link', { name: 'Guides & docs' });
  readonly activityLogsLink = this.page.getByRole('link', { name: 'Activity logs' });
  readonly usageSectionButton = this.page.getByRole('link', { name: 'Plan usage' });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  section(name: 'Overview' | 'API keys' | 'Endpoints' | 'Webhooks' | 'Plan usage' | 'Developer tools') {
    /* Section links are rendered in both the shell sub-nav and the in-page
       tab strip; target the in-page one. */
    return this.page
      .getByRole('navigation', { name: 'Developer API sections' })
      .getByRole('link', { name, exact: true });
  }

  async openSection(name: 'API keys' | 'Endpoints' | 'Webhooks' | 'Plan usage' | 'Developer tools'): Promise<void> {
    const link = this.section(name);
    await expect(link).toBeVisible();
    await link.click();

    /* The in-page tabs are client-routed; on a freshly hydrated page the
       first click can be swallowed, so retry once before asserting. */
    if (!/[?&]section=/.test(this.page.url())) {
      await this.page.waitForTimeout(400);
      await link.click();
    }

    await expect(this.page).toHaveURL(/[?&]section=/);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectKeyEmptyState(): Promise<void> {
    await expect(this.page.getByText('No API keys yet')).toBeVisible();
  }

  /**
   * Keys panel is ready whether or not keys exist. Note: "Create key"
   * creates a key immediately (no confirm step), so specs must never click it.
   */
  async expectKeysPanel(): Promise<void> {
    await expect(this.createKeyButton).toBeVisible();
    await expect(this.page.getByText(/secret is shown once/)).toBeVisible();
  }
}
