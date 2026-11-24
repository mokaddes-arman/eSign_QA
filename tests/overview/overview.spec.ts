import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';
import { textsIn } from '../../src/helpers/ui';

test.describe('Overview dashboard @smoke', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.goto();
    await overviewPage.expectLoaded();
  });

  test('OVR-001 workspace summary figures match the workspace data', async ({ overviewPage, page, navigation }) => {
    const [me, docs, usage] = await Promise.all([
      page.request.get(API.me).then((r) => r.json()),
      page.request.get(API.documents).then((r) => r.json()),
      page.request.get(API.billingUsage).then((r) => r.json()),
    ]);
    const figure = async (card: Parameters<typeof overviewPage.summaryCard>[0]) => textsIn(overviewPage.summaryCard(card), 'p');

    await expect(page.getByRole('region', { name: 'Workspace summary', exact: true }).getByText(me.organization_name, { exact: true })).toBeVisible();
    for (const card of ['Action required', 'Out for signature', 'Envelopes', 'Seats activated', 'Completion rate'] as const) {
      await expect(overviewPage.summaryCard(card)).toBeVisible();
    }

    const since = Date.now() - 90 * 24 * 3600 * 1000;
    const recent = (docs as { created_at: string; status: string }[]).filter((d) => Date.parse(d.created_at) >= since);
    expect(await figure('Envelopes'), 'Envelopes = documents created in the last 90 days (API)').toEqual(['Envelopes', String(recent.length), 'last 90 days']);

    const completed = recent.filter((d) => d.status === 'completed').length;
    const rate = recent.length ? Math.round((100 * completed) / recent.length) : 0;
    expect((await figure('Completion rate'))[1], `Completion rate = ${completed} completed of ${recent.length}`).toBe(`${rate}%`);

    const seats = usage.limits.max_documents_per_month.seats;
    expect(await figure('Seats activated'), 'Seats = active users of licensed seats (billing API)').toEqual(['Seats activated', String(usage.limits.max_users.used), `of ${seats}`]);

    /* The sidebar plan widget shows this month's signature requests against the plan limit
       (on phones it lives in the navigation drawer). */
    await navigation.open();
    const widget = page.getByRole('region', { name: /plan · envelope usage this month/ });
    const quota = usage.limits.max_documents_per_month;
    await expect(widget).toContainText(usage.plan_name);
    await expect(widget).toContainText(new RegExp(`${quota.used}\\s*/ ${quota.limit}`));
  });

  test('OVR-003 template, volume, spend and team widgets reflect the workspace data', async ({ overviewPage, page }) => {
    const [me, templates] = await Promise.all([
      page.request.get(API.me).then((r) => r.json()),
      page.request.get(API.templates).then((r) => r.json()),
    ]);

    /* Templates: every card is a real template, described with its own page/field/signer counts. */
    const templateRegion = page.getByRole('region', { name: 'Start from a template' });
    const cardLabel = /\d+ pages? · \d+ fields? · \d+ signers?$/;
    const items = templates.items as { title: string; page_count: number; field_count: number; recipient_count: number }[];
    const described = new Set(items.map((t) => `${t.title} ${t.page_count} page${t.page_count === 1 ? '' : 's'} · ${t.field_count} field${t.field_count === 1 ? '' : 's'} · ${t.recipient_count} signer${t.recipient_count === 1 ? '' : 's'}`));
    if (items.length === 0) await expect(overviewPage.templateEmptyState).toBeVisible();
    else await expect(templateRegion.getByRole('button', { name: cardLabel }).first()).toBeVisible();
    for (const label of (await textsIn(templateRegion, 'button')).filter((t) => cardLabel.test(t))) {
      expect([...described], 'template card not matching any template (API)').toContain(label);
    }

    /* Volume: the headline total and peak are computed from the weekly table. */
    const volume = overviewPage.envelopeVolumeChart;
    const table = volume.getByRole('table', { name: /Envelopes created per week/ });
    const weekly = (await textsIn(table, 'td')).map(Number);
    expect(weekly).toHaveLength(12);
    const total = weekly.reduce((a, b) => a + b, 0);
    await expect(volume.getByText(/Envelopes created per week, \d+ in all/)).toHaveText(`Envelopes created per week, ${total} in all.`);
    await expect(volume.getByText(/^peak \d+ \/ wk$/)).toHaveText(`peak ${Math.max(...weekly)} / wk`);
    const latestWeek = (await table.getByRole('rowheader').last().innerText()).trim();
    await expect(volume.getByRole('figure')).toContainText(new RegExp(`^${weekly[11]}\\s*envelopes? · ${latestWeek} \\(latest\\)`));

    /* Spend: the headline equals the sum of its lines; each line is quantity × unit price. */
    const spend = overviewPage.spendSection;
    const money = (t: string) => Number(t.replace(/[^\d.]/g, ''));
    const lines = await textsIn(spend, 'dt');
    const amounts = (await textsIn(spend, 'dd')).map(money);
    expect(lines.length, 'Spend lists no invoice line').toBeGreaterThan(0);
    lines.forEach((line, i) => {
      const [, qty, price] = line.match(/^(\d+) × .+ \(at \$([\d.,]+) \/ \w+\)$/) ?? [];
      expect(qty, `unexpected spend line "${line}"`).toBeTruthy();
      expect(amounts[i], line).toBeCloseTo(Number(qty) * money(price), 2);
    });
    expect(money(await spend.locator('strong').first().innerText())).toBeCloseTo(amounts.reduce((a, b) => a + b, 0), 2);

    /* Team activity lists the signed-in admin. */
    await expect(overviewPage.teamSection.getByRole('listitem').filter({ hasText: me.name })).toContainText(/Organization admin/);
    await expect(overviewPage.attentionList).toBeVisible();
  });

  test('starts a new envelope from the summary', async ({ overviewPage, page }) => {
    await overviewPage.newEnvelopeButton.click();
    await expect(page).toHaveURL(/\/documents\/prepare/);
    await expect(
      page.getByRole('heading', { name: 'New envelope', exact: true }),
    ).toBeVisible();
  });

  test('opens the templates library', async ({ overviewPage }) => {
    await overviewPage.browseTemplatesLink.click();
    await expect(overviewPage.page).toHaveURL(/folder=templates/);
  });

  test('OVR-007 plan line names the billed plan and its renewal date', async ({ overviewPage, page }) => {
    const usage = await (await page.request.get(API.billingUsage)).json();
    /* Format in the browser so the expected date uses the same time zone as the app. */
    const renews = await page.evaluate((iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), usage.period_end);
    await expect(page.getByRole('region', { name: 'Workspace summary', exact: true })).toContainText(`${usage.plan_name} · renews ${renews}`);
  });

  test('OVR-008 attention count matches the list and each item opens its page', async ({ overviewPage, page }) => {
    /* The headline ("… — N item(s) need(s) your attention.") states how many items the list must show. */
    const summary = page.getByRole('region', { name: 'Workspace summary', exact: true });
    await expect(summary).toContainText(/renews/);
    const count = Number((await summary.innerText()).match(/(\d+) items? needs? your attention/)?.[1] ?? 0);
    const items = overviewPage.attentionList.getByRole('listitem');
    await expect(items).toHaveCount(count);
    if (count === 0) return; /* nothing to open: the empty list matching the headline is the check */
    await expect(async () => {
      if (/\/overview/.test(page.url())) await items.first().getByRole('button').click();
      await expect(page).not.toHaveURL(/\/overview/, { timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('BUG-33 envelope volume lists 12 consecutive weeks', knownBug(KNOWN_BUGS.BUG33), async ({ page }) => {
    expectOpenBugsToFail();
    const weeks = (await page.getByRole('table', { name: /Envelopes created per week/ }).getByRole('rowheader').allInnerTexts()).map((w) => Number(w.replace(/\D/g, '')));
    expect(weeks).toHaveLength(12);
    /* Consecutive ISO weeks (W52/W53 → W1 wraps at the year boundary). */
    const gaps = weeks.slice(1).map((w, i) => `W${weeks[i]}→W${w}`).filter((_, i) => !(weeks[i + 1] === weeks[i] + 1 || (weeks[i + 1] === 1 && weeks[i] >= 52)));
    expect(gaps, `non-consecutive weeks: ${weeks.map((w) => `W${w}`).join(', ')}`).toEqual([]);
  });
});
