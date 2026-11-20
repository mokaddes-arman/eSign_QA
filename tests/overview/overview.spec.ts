import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';

test.describe('Overview dashboard @smoke', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.goto();
    await overviewPage.expectLoaded();
  });

  test('shows workspace summary and key figures', async ({ overviewPage, page }) => {
    await expect(overviewPage.workspaceName).toBeVisible();
    await expect(page.getByRole('region', { name: 'Workspace summary figures' })).toBeVisible();

    for (const card of [
      'Action required',
      'Out for signature',
      'Envelopes',
      'Seats activated',
      'Completion rate',
    ] as const) {
      await expect(overviewPage.summaryCard(card)).toBeVisible();
    }
  });

  test('shows template, volume, spend and team widgets', async ({ overviewPage }) => {
    await expect(overviewPage.envelopeVolumeChart).toBeVisible();
    await expect(overviewPage.attentionList).toBeVisible();
    await expect(overviewPage.spendSection).toBeVisible();
    await expect(overviewPage.teamSection).toBeVisible();
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
    test.skip(count === 0, 'No attention items in this workspace');
    const items = overviewPage.attentionList.getByRole('listitem');
    await expect(items).toHaveCount(count);
    await expect(async () => {
      if (/\/overview/.test(page.url())) await items.first().getByRole('button').click();
      await expect(page).not.toHaveURL(/\/overview/, { timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('BUG-33 envelope volume lists 12 consecutive weeks', knownBug(KNOWN_BUGS.BUG33), async ({ page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const weeks = (await page.getByRole('table', { name: /Envelopes created per week/ }).getByRole('rowheader').allInnerTexts()).map((w) => Number(w.replace(/\D/g, '')));
    expect(weeks).toHaveLength(12);
    /* Consecutive ISO weeks (W52/W53 → W1 wraps at the year boundary). */
    const gaps = weeks.slice(1).map((w, i) => `W${weeks[i]}→W${w}`).filter((_, i) => !(weeks[i + 1] === weeks[i] + 1 || (weeks[i + 1] === 1 && weeks[i] >= 52)));
    expect(gaps, `non-consecutive weeks: ${weeks.map((w) => `W${w}`).join(', ')}`).toEqual([]);
  });
});
