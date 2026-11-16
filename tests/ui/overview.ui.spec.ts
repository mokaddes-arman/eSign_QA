import { test, expect } from '../../src/fixtures/test';
import { uiBaseline } from '../../src/helpers/uiSuite';

test.describe('UI · Overview', () => {
  uiBaseline([{ name: 'Overview', path: '/overview', ready: (p) => p.getByRole('heading', { level: 1, name: 'Overview' }) }]);

  test('every KPI card shows a value', async ({ overviewPage }) => {
    await overviewPage.goto();
    for (const card of ['Action required', 'Out for signature', 'Envelopes', 'Seats activated', 'Completion rate'] as const) {
      const el = overviewPage.summaryCard(card);
      await expect(el).toBeVisible();
      await expect(el, `${card} card should show a number`).toContainText(/\d/);
    }
  });

  test('volume chart has an accessible data alternative', async ({ overviewPage }) => {
    await overviewPage.goto();
    await expect(overviewPage.envelopeVolumeChart).toBeVisible();
    const alternatives =
      (await overviewPage.envelopeVolumeChart.getByRole('table').count()) +
      (await overviewPage.envelopeVolumeChart.getByRole('img').count());
    expect(alternatives, 'chart needs a data table or a labelled image').toBeGreaterThan(0);
  });
});
