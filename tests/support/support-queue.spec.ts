import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';

test.describe('Support queue controls', () => {
  test('search, sort, export and status chips are available', async ({ supportPage, page }) => {
    await supportPage.goto();
    await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const sorts = await optionLabels(supportPage.sortFilter);
    expect(sorts).toEqual(
      expect.arrayContaining(['SLA risk', 'Recently updated', 'Newest first', 'Oldest first', 'Priority']),
    );
    for (const chip of ['Open', 'Escalated', 'Pending', 'Resolved']) {
      await expect(
        page.getByRole('group', { name: 'Status' }).getByRole('button', { name: new RegExp(`^${chip}`) }),
      ).toBeVisible();
    }
    for (const chip of ['Breached', 'Unassigned', 'P1 open']) {
      await expect(
        page.getByRole('group', { name: 'Needs attention' }).getByRole('button', { name: new RegExp(`^${chip}`) }),
      ).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Ticket queue pagination' })).toBeVisible();
  });

  test('new ticket defaults to P3 · Normal', async ({ supportPage }) => {
    await supportPage.goto();
    await supportPage.openNewTicket();
    await expect(supportPage.prioritySelect.locator('option:checked')).toHaveText('P3 · Normal');
    await supportPage.dialog.getByRole('button', { name: 'Cancel' }).click();
  });
});
