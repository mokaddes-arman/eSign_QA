import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';
import { API } from '../../src/helpers/api';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';
import { requireData } from '../../src/helpers/precondition';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/* Read-only checks of the account sub-pages and the notifications centre. */
test.describe('Account settings pages', () => {
  test('notifications centre exposes filters and bulk actions', async ({ page }) => {
    await page.goto('/notifications');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toBeVisible();
    const windows = await optionLabels(page.getByLabel('Time window'));
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

  test('ACC-015 UF-43 audit trail filters by event type and pages through the matching rows', async ({ page }) => {
    await page.goto('/account/audit');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Audit trail' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search the audit log' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Events from date' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Events to date' })).toBeVisible();
    const log = page.getByRole('region', { name: 'Account audit log' });
    await expect(log.getByRole('columnheader')).toHaveText(['Event', 'User', 'Details', 'Document', 'IP address', 'Time']);

    const typeFilter = page.getByLabel('Filter by event type');
    const types = (await optionLabels(typeFilter)).filter((t) => t !== 'All event types');
    requireData(types.length > 0, 'the audit log offers no event type to filter by');
    const rows = log.getByRole('row').filter({ has: page.getByRole('cell') });
    const summary = page.getByText(/^Showing \d+–\d+ of \d+ matching events?$/);
    const total = async () => Number((await summary.innerText()).match(/of (\d+)/)![1]);
    const pager = page.getByRole('navigation', { name: 'Audit log pagination' });

    /* Filter by the event type with the most rows, so paging is exercised when the trail allows it. */
    let chosen = types[0];
    let matching = 0;
    for (const type of types) {
      await typeFilter.selectOption({ label: type });
      await expect(rows.first().getByRole('cell').first()).toHaveText(type);
      const n = await total();
      if (n > matching) [chosen, matching] = [type, n];
    }
    await typeFilter.selectOption({ label: chosen });
    const plural = matching === 1 ? '' : 's';
    await expect(summary).toHaveText(`Showing 1–${Math.min(25, matching)} of ${matching} matching event${plural}`);
    await expect(rows).toHaveCount(Math.min(25, matching));
    for (const event of await rows.locator('td:first-child').allInnerTexts()) expect(event.trim(), `filtered on ${chosen}`).toBe(chosen);

    const pages = Math.ceil(matching / 25);
    await expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    if (pages > 1) {
      await expect(pager.getByRole('button', { name: 'Page 2' })).toBeVisible();
      const firstPage = await rows.allInnerTexts();
      await pager.getByRole('button', { name: 'Next page' }).click();
      await expect(summary).toHaveText(`Showing 26–${Math.min(50, matching)} of ${matching} matching events`);
      await expect(rows).toHaveCount(Math.min(25, matching - 25));
      /* The summary updates before the table re-renders: wait for the new rows. */
      await expect.poll(() => rows.allInnerTexts(), { message: 'page 2 should show different events' }).not.toEqual(firstPage);
      for (const event of await rows.locator('td:first-child').allInnerTexts()) expect(event.trim()).toBe(chosen);
      await expect(pager.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    } else {
      await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();
    }

    /* The user filter narrows to that user's events. */
    const me = await (await page.request.get(API.me)).json();
    await typeFilter.selectOption({ label: 'All event types' });
    await page.getByLabel('Filter by user').selectOption({ label: me.email });
    await expect(rows.first()).toBeVisible();
    for (const user of await rows.locator('td:nth-child(2)').allInnerTexts()) expect(user.trim()).toBe(me.email);
  });

  test('ACC-014 organization page lists the organization, its people, teams and field palette', async ({ page }) => {
    const me = await (await page.request.get(API.me)).json();
    await page.goto('/account/organization');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Organization & teams' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Organization', exact: true }).getByText(me.organization_name, { exact: true })).toBeVisible();

    /* People: the heading count equals the rows, and the signed-in user is listed with their role. */
    const people = page.getByRole('region', { name: 'People in this organization' });
    const members = people.getByRole('row').filter({ has: page.getByRole('cell') });
    const headingCount = Number((await page.getByRole('heading', { level: 3, name: /^People\b/ }).innerText()).match(/(\d+)\s*$/)![1]);
    await expect(members).toHaveCount(headingCount);
    const meRow = members.filter({ hasText: `${me.name} · you` });
    await expect(meRow).toContainText(me.email);
    await expect(meRow.getByRole('cell').nth(1)).toHaveText(me.role);
    await expect(page.getByRole('button', { name: 'Invite member' })).toBeVisible();

    /* Teams: either listed or the empty state. */
    const teams = page.getByRole('region', { name: 'Teams', exact: true });
    await expect(teams.getByRole('button', { name: 'Create team' })).toBeVisible();
    const emptyTeams = await teams.getByText('This organization has no teams yet.').count();
    const teamRows = await teams.getByRole('row').filter({ has: page.getByRole('cell') }).count();
    expect(emptyTeams + teamRows, 'Teams shows neither teams nor its empty state').toBeGreaterThan(0);

    const palette = page.getByRole('group', { name: 'Field types offered in the builder palette' });
    await expect(palette.getByRole('checkbox')).toHaveCount(16);
    await expect(page.getByRole('button', { name: 'Save palette' })).toBeVisible();
  });

  test('BUG-38 organization card shows the seats Billing charges for', knownBug(KNOWN_BUGS.BUG38), async ({ page }) => {
    expectOpenBugsToFail();
    const usage = await (await page.request.get(API.billingUsage)).json();
    const seats = usage.limits.max_documents_per_month.seats as number;
    await page.goto('/account/organization');
    await waitForHydration(page);
    const label = seats === 1 ? '1 seat' : `${seats} seats`;
    await expect(page.getByRole('region', { name: 'Organization', exact: true })).toContainText(label);
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

  test('BUG-39 UF-42 inviting a member lists the pending invitation', knownBug(KNOWN_BUGS.BUG39, ['@data']), async ({ page }) => {
    expectOpenBugsToFail();
    /* Fixed example.com address: no mailbox receives it, and reruns reuse one invitation. */
    const invitee = 'qa.invite.check@example.com';
    await page.goto('/account/organization');
    await waitForHydration(page);
    const people = page.getByRole('region', { name: 'People in this organization' });
    const inviteRow = people.getByRole('row').filter({ hasText: invitee });
    try {
      if ((await inviteRow.count()) === 0) {
        const dialog = page.getByRole('dialog', { name: 'Invite someone' });
        await clickUntilVisible(page.getByRole('button', { name: 'Invite member' }), dialog);
        await dialog.getByRole('textbox', { name: 'Work email' }).fill(invitee);
        await dialog.getByRole('button', { name: 'Next' }).click();
        await expect(dialog.getByRole('combobox', { name: 'Role' })).toHaveValue(/sender/i);
        const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/proxy\/invitations$/.test(new URL(r.url()).pathname));
        await dialog.getByRole('button', { name: 'Send invitation' }).click();
        const response = await created;
        const body = await response.text();
        /* No answer may reveal an internal host or port. */
        expect(body, 'the error exposes an internal address').not.toMatch(/127\.0\.0\.1|localhost:\d+/);
        expect(response.status(), `POST /invitations answered ${response.status()}: ${body}`).toBeLessThan(400);
        await expect(dialog).toBeHidden();
      }
      await expect(inviteRow, 'the invitation should be listed as pending').toHaveCount(1);
      await expect(inviteRow).toContainText(/invited|pending/i);
    } finally {
      /* Revoke it again so the organization stays as it was. */
      if (await inviteRow.count()) {
        await inviteRow.getByRole('button', { name: /revoke|cancel|remove|withdraw/i }).first().click().catch(() => undefined);
        await page.getByRole('dialog').getByRole('button', { name: /revoke|remove|withdraw|confirm/i }).last().click({ timeout: 5_000 }).catch(() => undefined);
      }
    }
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

  test('ACC-013 integrations page explains each connector it cannot offer and the export history', async ({ page }) => {
    await page.goto('/account/integrations');
    await waitForHydration(page);

    const connectors = page.getByRole('region', { name: 'Storage connectors' });
    for (const name of ['Google Drive', 'Dropbox']) {
      const heading = connectors.getByRole('heading', { level: 4, name });
      await expect(heading).toBeVisible();
      /* Unavailable ⇒ Connect disabled and the reason spelled out; available ⇒ Connect enabled. */
      const card = heading.locator('xpath=ancestor::*[.//button[normalize-space()="Connect"]][1]');
      const connect = card.getByRole('button', { name: 'Connect' });
      if (await card.getByText('Not available on this deployment').count()) {
        await expect(connect, `${name}: Connect must be disabled when the connector is unavailable`).toBeDisabled();
        await expect(connectors.getByText(`This deployment has no ${name} credentials`)).toBeVisible();
      } else {
        await expect(connect, `${name}: Connect must be usable when the connector is available`).toBeEnabled();
      }
    }

    const exports = page.getByRole('region', { name: 'Recent exports' }).last();
    await expect(exports.getByRole('columnheader')).toHaveText(['Document', 'Connector', 'When', 'Written to', 'Status', 'Actions']);
    const rows = await exports.getByRole('row').filter({ has: page.getByRole('cell') }).count();
    const empty = await exports.getByText('Nothing has been exported yet').count();
    expect(empty + rows, 'Recent exports shows neither exports nor its empty state').toBeGreaterThan(0);
  });

  test('payments page offers Stripe Connect and payment filters', async ({ page }) => {
    await page.goto('/account/payments');
    await waitForHydration(page);

    await expect(page.getByRole('button', { name: 'Connect Stripe' })).toBeVisible();
    const types = await optionLabels(page.getByLabel('Business type'));
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
