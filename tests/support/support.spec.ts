import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';
import { textsIn } from '../../src/helpers/ui';

test.describe('Support tickets', () => {
  test.beforeEach(async ({ supportPage }) => {
    await supportPage.goto();
  });

  test('SUP-001 ticket counters agree with the queue and each status chip filters it @smoke', async ({ supportPage, page }) => {
    await expect(supportPage.heading).toBeVisible();
    await expect(supportPage.newTicketButton).toBeVisible();
    await expect(supportPage.statusFilter).toBeVisible();
    await expect(supportPage.priorityFilter).toBeVisible();

    const chips = page.getByRole('group', { name: 'Status' });
    const chipCount = async (name: string) => Number((await chips.getByRole('button', { name: new RegExp(`^${name} \\d+$`) }).innerText()).match(/(\d+)$/)![1]);
    const counts = Object.fromEntries(await Promise.all(['All', 'Open', 'Escalated', 'Pending', 'Resolved'].map(async (n) => [n, await chipCount(n)] as const)));
    expect(counts.Open + counts.Escalated + counts.Pending + counts.Resolved, `status chips should add up to All (${JSON.stringify(counts)})`).toBe(counts.All);

    const figure = async (card: string) => textsIn(page.getByRole('region', { name: 'Ticket summary' }).getByRole('article', { name: card }), 'p');
    const open = await figure('Your open tickets');
    expect(open[1], '"Your open tickets" vs the Open chip').toBe(String(counts.Open));
    expect(open[2], 'escalated count vs the Escalated chip').toBe(`${counts.Escalated} escalated`);

    const rows = page.getByRole('group', { name: 'Ticket queue' }).getByRole('row').filter({ has: page.getByRole('checkbox', { name: /^Select TKT-/ }) });
    const pageRows = await rows.count();
    expect(pageRows, 'rows on the first page').toBe(Math.min(counts.All, 25));
    if (counts.All > 0) await expect(page.getByText(/^Showing \d+–\d+ of \d+$/)).toHaveText(`Showing 1–${pageRows} of ${counts.All}`);

    /* Each non-empty status chip narrows the queue to exactly its tickets. */
    for (const status of ['Open', 'Escalated', 'Pending', 'Resolved'] as const) {
      if (counts[status] === 0) continue;
      const chip = chips.getByRole('button', { name: new RegExp(`^${status} \\d+$`) });
      await expect(async () => {
        if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await expect(rows).toHaveCount(Math.min(counts[status], 25));
      for (const row of await rows.all()) await expect(row.getByRole('cell').nth(3), `${status} chip`).toHaveText(status);
    }
  });

  test('opens a new ticket with category and priority options', async ({ supportPage }) => {
    await supportPage.openNewTicket();

    await expect(supportPage.subjectInput).toBeVisible();
    await expect(supportPage.descriptionInput).toBeVisible();

    const categories = await optionLabels(supportPage.categorySelect);
    expect(categories).toEqual(
      expect.arrayContaining([
        'Signing issue',
        'Document preparation',
        'API / integration',
        'Billing & invoices',
        'Security & compliance',
      ]),
    );

    const priorities = await optionLabels(supportPage.prioritySelect);
    expect(priorities).toEqual(
      expect.arrayContaining(['P1 · Urgent — signing blocked', 'P2 · High', 'P3 · Normal', 'P4 · Low']),
    );

    await supportPage.dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(supportPage.dialog).toBeHidden();
  });

  test('validates that a ticket cannot be submitted empty', async ({ supportPage }) => {
    await supportPage.openNewTicket();

    /* The app blocks an empty ticket client-side without any message (see
       FEATURES O9), so assert the outcome: no write request, dialog stays. */
    const writes: string[] = [];
    supportPage.page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().startsWith(new URL(supportPage.page.url()).origin)) {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });
    await supportPage.submitButton.click();
    await supportPage.page.waitForTimeout(1_000);

    expect(writes).toEqual([]);
    await expect(supportPage.dialog).toBeVisible();
    await supportPage.dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(supportPage.dialog).toBeHidden();
    /* Data-independent: the queue (or its empty state) is back, with nothing new in it. */
    await expect(supportPage.table.or(supportPage.emptyState).first()).toBeVisible();
  });
});
