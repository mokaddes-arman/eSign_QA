import { test, expect } from '../../src/fixtures/test';
import { waitForHydration } from '../../src/helpers/wait';

test.describe('Report sections', () => {
  test('documents report has per-envelope columns', async ({ page }) => {
    await page.goto('/reports?section=documents');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Documents report' })).toBeVisible();
    for (const column of ['Document', 'Recipients', 'Signed', 'Status', 'Updated', 'Progress']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('templates report has inventory columns', async ({ page }) => {
    await page.goto('/reports?section=templates');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Templates report' })).toBeVisible();
    for (const column of ['Template', 'Uses', 'Fields', 'Owner', 'Updated']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('all reports lists every standard CSV export', async ({ page }) => {
    await page.goto('/reports?section=all');
    await waitForHydration(page);
    for (const report of [
      'Documents report',
      'Templates report',
      'Templates usage report',
      'Completed copies report',
      'Recipients report',
      'Audit export',
    ]) {
      await expect(page.getByRole('button', { name: new RegExp(`^${report}`) })).toBeVisible();
    }
  });

  test('custom report builder adds a dimension as a column', async ({ page }) => {
    await page.goto('/reports?section=custom');
    await waitForHydration(page);
    const dimensions = page.getByRole('group', { name: 'Available dimensions' });
    await expect(dimensions.getByRole('button')).toHaveCount(9);
    await expect(page.getByText('Pick dimensions above to compose a report.')).toBeVisible();

    await dimensions.getByRole('button', { name: 'Envelope status' }).click();
    await expect(page.getByText('Pick dimensions above to compose a report.')).toBeHidden();
    for (const action of ['Save definition', 'Schedule weekly', 'Run report']) {
      await expect(page.getByRole('button', { name: action })).toBeVisible();
    }
  });
});
