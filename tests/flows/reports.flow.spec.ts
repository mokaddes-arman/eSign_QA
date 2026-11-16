import { test, expect } from '../../src/fixtures/test';
import { renderingArtifacts } from '../../src/helpers/ui';

/** UF-34 — an admin reviews activity across ranges and report sections. */
test.describe('Flow · Reports', () => {
  test('UF-34 every report section loads for a changed date range @flow', async ({ reportsPage, page }) => {
    test.setTimeout(120_000);

    await test.step('open reports and change the range', async () => {
      await reportsPage.goto();
      await reportsPage.selectRange('Last 12 months');
    });

    for (const section of ['By document', 'By template', 'By recipient', 'All reports', 'Custom report', 'My analytics'] as const) {
      await test.step(`${section} loads without raw values`, async () => {
        await reportsPage.openSection(section);
        await expect(reportsPage.heading).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: /reach the eSignPro API|error/i })).toHaveCount(0);
        expect.soft(await renderingArtifacts(page), `${section} shows NaN/undefined`).toEqual([]);
      });
    }
  });
});
