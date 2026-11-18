import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OverviewPage extends BasePage {
  protected readonly path = '/overview';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Overview' });
  readonly newEnvelopeButton = this.healButton('New envelope', false);
  readonly takeTourButton = this.healButton('Take the tour', false);
  readonly workspaceName = this.page.getByText('Global Softel').first();
  readonly planLine = this.page.getByText(/renews .* — .* needs your attention/);

  summaryCard(name: 'Action required' | 'Out for signature' | 'Envelopes' | 'Seats activated' | 'Completion rate') {
    return this.page.getByRole('article', { name });
  }

  readonly templateEmptyState = this.page.getByText('No templates yet');
  readonly browseTemplatesLink = this.page.getByRole('link', { name: 'Browse all templates' });
  readonly envelopeVolumeChart = this.page.getByRole('region', { name: /Envelope volume/ });
  readonly attentionList = this.page.getByRole('region', { name: 'Needs your attention' });
  readonly spendSection = this.page.getByRole('region', { name: 'Spend this cycle' });
  readonly teamSection = this.page.getByRole('region', { name: 'Team activity' });

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByRole('region', { name: 'Workspace summary figures' })).toBeVisible();
  }

  async openDocuments(): Promise<void> {
    await this.browseTemplatesLink.click();
    await expect(this.page).toHaveURL(/\/documents\?folder=templates/);
  }
}
