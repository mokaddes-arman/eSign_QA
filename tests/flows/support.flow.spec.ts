import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

/** UF-38 / SUP-005 — raise a ticket, find it in the queue with its SLA, then resolve it. */
test.describe('Flow · Support ticket', () => {
  test('SUP-005 UF-38 a new ticket is listed as Open with an SLA, then resolved @flow @data', async ({ supportPage, page }) => {
    /* Clearly labelled so support staff can ignore it; resolved at the end. */
    const subject = `[QA automation] ticket check ${Date.now()} - please ignore`;
    const row = page.getByRole('row').filter({ hasText: subject });
    await supportPage.goto();
    const openCount = page.getByRole('group', { name: 'Status' }).getByRole('button', { name: /^Open \d+/ });
    const before = Number((await openCount.innerText()).replace(/\D/g, ''));

    await supportPage.openNewTicket();
    await supportPage.fillTicket({ subject, category: 'Document preparation', priority: 'P4 · Low', description: 'Automated QA check of ticket creation. No action needed.' });
    await supportPage.submitButton.click();
    await expect(supportPage.dialog).toBeHidden();

    try {
      await expect(row).toBeVisible({ timeout: 20_000 });
      for (const cell of ['Open', 'P4 Low', /\d+h \d+m left/]) await expect(row).toContainText(cell);
      await expect(openCount).toHaveText(new RegExp(`^Open ${before + 1}`));
    } finally {
      if (await row.isVisible().catch(() => false)) {
        const resolve = page.getByRole('button', { name: 'Mark resolved' });
        await clickUntilVisible(row.getByRole('button', { name: /^TKT-/ }), resolve);
        await resolve.click();
        await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('resolved');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(row).toContainText('Resolved', { timeout: 20_000 });
      }
    }
  });
});
