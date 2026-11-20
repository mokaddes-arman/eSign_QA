import type { Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';

test.describe('Reports & analytics @smoke', () => {
  test.beforeEach(async ({ reportsPage }) => {
    await reportsPage.goto();
  });

  test('shows the analytics scorecard and date ranges', async ({ reportsPage }) => {
    await expect(reportsPage.heading).toBeVisible();
    await expect(reportsPage.analyticsHeading).toBeVisible();
    await expect(reportsPage.exportButton).toBeVisible();

    const ranges = await optionLabels(reportsPage.dateRangeSelect);
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

  test('BUG-28 report section tabs still navigate after the period is changed', knownBug(KNOWN_BUGS.BUG28), async ({ reportsPage, page, browserName }) => {
    /* WebKit-only defect: Chromium and Firefox navigate, so only WebKit is expected to fail. */
    test.fail(expectBugsToFail && browserName === 'webkit', 'KNOWN_BUGS=expect-fail (BUG-28 is WebKit-only)');
    await reportsPage.selectRange('Last 12 months');
    /* One click per tab, generous wait: a working tab navigates in < 2 s. No retries here —
       the defect is precisely that the click is ignored. */
    for (const [section, param] of [['By template', 'templates'], ['By recipient', 'recipients']] as const) {
      const tab = page.getByRole('main').getByRole('link', { name: section, exact: true });
      await expect(tab).toHaveAttribute('href', new RegExp(`section=${param}&range=12m`));
      await tab.click();
      await expect(page, `Clicking the "${section}" tab after changing the period did not open it`).toHaveURL(new RegExp(`section=${param}`), { timeout: 15_000 });
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

  test('REP-007 export downloads a CSV that matches the invite outcomes on screen', async ({ reportsPage, page }) => {
    await reportsPage.selectRange('Last 12 months');
    /* Changing the period re-renders the page; a click before hydration is dropped (R3), so retry. */
    let download!: Download;
    await expect(async () => {
      [download] = await Promise.all([page.waitForEvent('download', { timeout: 5_000 }), reportsPage.exportButton.click()]);
    }).toPass({ timeout: 30_000 });
    expect(download.suggestedFilename()).toMatch(/^invites-12m\.csv$/);
    const [header, ...rows] = (await readFile(await download.path(), 'utf8')).trim().split(/\r?\n/);
    expect(header).toBe('label,count');
    const csv = Object.fromEntries(rows.map((r) => r.split(',')));
    const outcomes = page.getByRole('list', { name: 'Invites by outcome' }).getByRole('listitem');
    await expect(outcomes).toHaveCount(rows.length);
    for (const item of await outcomes.all()) {
      const label = (await item.innerText()).split('\n')[0].trim().toLowerCase().replace(/\s*\/\s*/g, '_');
      expect(csv[label], `CSV row for "${label}"`).toBe((await item.locator('strong').innerText()).trim());
    }
  });
});
