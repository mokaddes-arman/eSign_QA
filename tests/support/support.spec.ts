import { test, expect } from '../../src/fixtures/test';

test.describe('Support tickets', () => {
  test.beforeEach(async ({ supportPage }) => {
    await supportPage.goto();
  });

  test('shows ticket counters and filters @smoke', async ({ supportPage }) => {
    await expect(supportPage.heading).toBeVisible();
    await expect(supportPage.newTicketButton).toBeVisible();
    await expect(supportPage.statusFilter).toBeVisible();
    await expect(supportPage.priorityFilter).toBeVisible();
  });

  test('opens a new ticket with category and priority options', async ({ supportPage }) => {
    await supportPage.openNewTicket();

    await expect(supportPage.subjectInput).toBeVisible();
    await expect(supportPage.descriptionInput).toBeVisible();

    const categories = await supportPage.categorySelect.locator('option').allTextContents();
    expect(categories).toEqual(
      expect.arrayContaining([
        'Signing issue',
        'Document preparation',
        'API / integration',
        'Billing & invoices',
        'Security & compliance',
      ]),
    );

    const priorities = await supportPage.prioritySelect.locator('option').allTextContents();
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
    await expect(supportPage.emptyState).toBeVisible();
  });
});
