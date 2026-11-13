import { test, expect } from '../../src/fixtures/test';

test.describe('Reports & analytics @smoke', () => {
  test.beforeEach(async ({ reportsPage }) => {
    await reportsPage.goto();
  });

  test('shows the analytics scorecard and date ranges', async ({ reportsPage }) => {
    await expect(reportsPage.heading).toBeVisible();
    await expect(reportsPage.analyticsHeading).toBeVisible();
    await expect(reportsPage.exportButton).toBeVisible();

    const ranges = await reportsPage.dateRangeSelect.locator('option').allTextContents();
    expect(ranges).toEqual(
      expect.arrayContaining([
        'Last 7 days',
        'Last 30 days',
        'Last quarter',
        'Last 12 months',
      ]),
    );
  });

  test('switches the reporting period', async ({ reportsPage }) => {
    await reportsPage.selectRange('Last 12 months');
    await expect(reportsPage.dateRangeSelect.locator('option:checked')).toHaveText(
      'Last 12 months',
    );
  });

  test('exposes every report section', async ({ reportsPage }) => {
    for (const section of [
      'All reports',
      'By document',
      'By template',
      'By recipient',
      'Custom report',
    ] as const) {
      await expect(reportsPage.sectionLink(section)).toBeVisible();
    }
  });

  test('navigates to the recipient report', async ({ reportsPage }) => {
    await reportsPage.openSection('By recipient');
    await expect(reportsPage.page).toHaveURL(/section=recipients/);
  });

  test('renders the invite performance table', async ({ reportsPage }) => {
    for (const column of [
      'Recipient',
      'Created',
      'Sent',
      'Pending',
      'Completed',
      'Cancelled',
      'Declined',
      'Rate',
    ]) {
      await expect(reportsPage.page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });
});
