import { test, expect } from '../../src/fixtures/test';

test.describe('Overview dashboard @smoke', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.goto();
    await overviewPage.expectLoaded();
  });

  test('shows workspace summary and key figures', async ({ overviewPage, page }) => {
    await expect(overviewPage.workspaceName).toBeVisible();
    await expect(page.getByRole('region', { name: 'Workspace summary figures' })).toBeVisible();

    for (const card of [
      'Action required',
      'Out for signature',
      'Envelopes',
      'Seats activated',
      'Completion rate',
    ] as const) {
      await expect(overviewPage.summaryCard(card)).toBeVisible();
    }
  });

  test('shows template, volume, spend and team widgets', async ({ overviewPage }) => {
    await expect(overviewPage.envelopeVolumeChart).toBeVisible();
    await expect(overviewPage.attentionList).toBeVisible();
    await expect(overviewPage.spendSection).toBeVisible();
    await expect(overviewPage.teamSection).toBeVisible();
  });

  test('starts a new envelope from the summary', async ({ overviewPage, page }) => {
    await overviewPage.newEnvelopeButton.click();
    await expect(page).toHaveURL(/\/documents\/prepare/);
    await expect(
      page.getByRole('heading', { name: 'New envelope', exact: true }),
    ).toBeVisible();
  });

  test('opens the templates library', async ({ overviewPage }) => {
    await overviewPage.browseTemplatesLink.click();
    await expect(overviewPage.page).toHaveURL(/folder=templates/);
  });
});
