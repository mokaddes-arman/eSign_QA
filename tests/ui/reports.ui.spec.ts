import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { uiBaseline } from '../../src/helpers/uiSuite';

const h1 = (p: Page) => p.getByRole('heading', { level: 1, name: 'Reports' });

test.describe('UI · Reports', () => {
  uiBaseline([
    { name: 'My analytics', path: '/reports', ready: h1 },
    { name: 'All reports', path: '/reports?section=all', ready: h1 },
    { name: 'By document', path: '/reports?section=documents', ready: h1 },
    { name: 'By template', path: '/reports?section=templates', ready: h1 },
    { name: 'By recipient', path: '/reports?section=recipients', ready: h1 },
    { name: 'Custom report', path: '/reports?section=custom', ready: h1 },
  ]);

  test('report tables have column headers', async ({ page }) => {
    for (const section of ['recipients', 'documents', 'templates']) {
      await page.goto(`/reports?section=${section}`, { waitUntil: 'domcontentloaded' });
      const table = page.getByRole('table').first();
      if (!(await table.isVisible({ timeout: 10_000 }).catch(() => false))) continue;
      expect(await table.getByRole('columnheader').count(), `${section} table needs headers`).toBeGreaterThan(1);
    }
  });

  test('recipient rows never show an empty recipient name', async ({ page }) => {
    await page.goto('/reports?section=recipients', { waitUntil: 'domcontentloaded' });
    const table = page.getByRole('table').first();
    test.skip(!(await table.isVisible({ timeout: 15_000 }).catch(() => false)), 'No recipient table for this period');
    const rows = table.locator('tbody tr');
    for (let i = 0; i < (await rows.count()); i++) {
      const first = (await rows.nth(i).locator('td, th').first().innerText()).trim();
      expect(first, `row ${i + 1} has an empty recipient (FEATURES O4)`).not.toBe('');
    }
  });
});
