import { test, expect } from '../../src/fixtures/test';

/*
 * Support queue search, filter combinations and status chips (SUP-006, SUP-009).
 * Read-only: the workspace has no tickets, so every combination must show the
 * empty state and keep the counters at zero without errors.
 */
test.describe('Support · queue search & filters', () => {
  test.beforeEach(async ({ supportPage }) => {
    await supportPage.goto();
  });

  test('SUP-009 ticket search with no match keeps the empty state', async ({ supportPage, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.getByRole('searchbox', { name: 'Search tickets' }).fill(`zz-no-ticket-${Date.now()}`);
    await page.waitForTimeout(800);
    await expect(supportPage.table.getByRole('row').filter({ hasText: /no support tickets|no tickets|nothing|no match/i })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('SUP-006 status and priority filters combine and can be reset', async ({ supportPage, page }) => {
    await supportPage.statusFilter.selectOption({ label: 'Escalated' });
    await supportPage.priorityFilter.selectOption({ label: 'P1 · Urgent' });
    await expect(supportPage.statusFilter).toHaveValue(/escalated/i);
    await expect(supportPage.table.getByRole('row').filter({ hasText: /no .*tickets|nothing|no match/i })).toHaveCount(1);

    await supportPage.statusFilter.selectOption({ label: 'All statuses' });
    await supportPage.priorityFilter.selectOption({ label: 'Any priority' });
    await expect(page.getByRole('group', { name: 'Status' }).getByRole('button', { name: /^All \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('SUP-006 status chip selection is exclusive and announced', async ({ page }) => {
    const chips = page.getByRole('group', { name: 'Status' });
    const open = chips.getByRole('button', { name: /^Open \d+$/ });
    /* A click before hydration is dropped (R3): retry while the chip is not yet pressed. */
    await expect(async () => {
      if ((await open.getAttribute('aria-pressed')) !== 'true') await open.click();
      await expect(open).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(chips.getByRole('button', { name: /^All \d+$/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
