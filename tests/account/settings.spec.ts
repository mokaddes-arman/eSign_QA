import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { waitForHydration } from '../../src/helpers/wait';

/* Read-only checks of the account sub-pages and the notifications centre. */
test.describe('Account settings pages', () => {
  test('notifications centre exposes filters and bulk actions', async ({ page }) => {
    await page.goto('/notifications');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toBeVisible();
    const windows = await page.getByLabel('Time window').locator('option').allTextContents();
    expect(windows).toEqual(
      expect.arrayContaining(['All time', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'Last 90 days']),
    );
    await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear read' })).toBeVisible();
    for (const kind of ['Problems', 'Warnings', 'Completions', 'Updates']) {
      await expect(
        page.getByRole('group', { name: 'Kind' }).getByRole('button', { name: new RegExp(`^${kind}`) }),
      ).toBeVisible();
    }
  });

  test('audit trail has filters, sortable columns and pagination', async ({ page }) => {
    await page.goto('/account/audit');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Audit trail' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search the audit log' })).toBeVisible();
    await expect(page.getByLabel('Filter by event type')).toBeVisible();
    await expect(page.getByLabel('Filter by user')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Events from date' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Events to date' })).toBeVisible();
    for (const column of ['Event', 'User', 'Details', 'Document', 'IP address', 'Time']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Audit log pagination' })).toBeVisible();
  });

  test('organization page lists people, teams and the field palette', async ({ page }) => {
    await page.goto('/account/organization');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Organization & teams' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite member' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create team' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Mokaddes SQA · you/ })).toBeVisible();

    const palette = page.getByRole('group', { name: 'Field types offered in the builder palette' });
    await expect(palette.getByRole('checkbox')).toHaveCount(16);
    await expect(page.getByRole('button', { name: 'Save palette' })).toBeVisible();
  });

  test('invite-member dialog requires an e-mail before continuing', async ({ page }) => {
    await page.goto('/account/organization');
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Invite member' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    await expect(dialog.getByRole('button', { name: 'Next' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('security page lists sessions and remembered browsers', async ({ page }) => {
    await page.goto('/account/security');
    await waitForHydration(page);

    await expect(page.getByRole('switch', { name: 'Two-factor authentication' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add passkey' })).toBeVisible();
    const devices = page.getByRole('region', { name: 'Authenticated devices and browsers' }).last();
    await expect(devices.getByRole('button', { name: 'Sign out here' }).first()).toBeVisible();
    const remembered = page.getByRole('region', { name: 'Remembered browsers' }).first();
    await expect(remembered.getByRole('button', { name: 'Forget all' })).toBeVisible();
  });

  test('integrations page shows storage connectors and export history', async ({ page }) => {
    await page.goto('/account/integrations');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { name: 'Google Drive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dropbox' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent exports' })).toBeVisible();
  });

  test('payments page offers Stripe Connect and payment filters', async ({ page }) => {
    await page.goto('/account/payments');
    await waitForHydration(page);

    await expect(page.getByRole('button', { name: 'Connect Stripe' })).toBeVisible();
    const types = await page.getByLabel('Business type').locator('option').allTextContents();
    expect(types).toEqual(
      expect.arrayContaining(['Company', 'Individual / sole proprietor', 'Non-profit', 'Government entity']),
    );
    for (const status of ['All', 'Collected', 'Refunded', 'Failed', 'In flight']) {
      await expect(
        page.getByRole('group', { name: 'Filter payments by status' }).getByRole('button', { name: status }),
      ).toBeVisible();
    }
  });

  test('branding is gated on the Free plan and available on paid plans', async ({ page, request }) => {
    const plan = (await (await request.get(API.billingUsage)).json()).plan_code as string;
    await page.goto('/account/brand');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Branding themes' })).toBeVisible();
    if (plan === 'free') {
      await expect(page.getByText('Branding is not included in the Free plan.'), 'Free plan must show the branding gate').toBeVisible();
      await expect(page.getByRole('link', { name: 'View plans' })).toBeVisible();
    } else {
      await expect(page.getByText(/not included in the .* plan/i), `Branding must not be gated on the ${plan} plan`).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'New theme' }), `The ${plan} plan should allow creating a theme`).toBeVisible();
    }
  });
});
