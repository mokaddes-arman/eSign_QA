import type { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { test, expect } from '../../src/fixtures/test';
import { waitForHydration } from '../../src/helpers/wait';
import { API } from '../../src/helpers/api';
import { requireData } from '../../src/helpers/precondition';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';
import { textsIn } from '../../src/helpers/ui';

type ApiDocument = { id: string; title: string; status: string; created_at: string; recipients_total: number; recipients_completed: number };
type ApiTemplate = { id: string; title: string; use_count: number; field_count: number; owner_name: string };

/** The widest period, so every envelope the API returns is in range. */
const RANGE = '12m';
const YEAR_MS = 365 * 24 * 3600 * 1000;

const envId = (id: string) => `ENV-${id.slice(0, 8).toUpperCase()}`;
const tplId = (id: string) => `TPL-${id.slice(0, 6).toUpperCase()}`;

async function apiData(page: Page) {
  const [docs, templates] = await Promise.all([
    page.request.get(API.documents).then((r) => r.json() as Promise<ApiDocument[]>),
    page.request.get(API.templates).then((r) => r.json() as Promise<{ items: ApiTemplate[] }>),
  ]);
  return { docs: docs.filter((d) => Date.now() - Date.parse(d.created_at) <= YEAR_MS), templates: templates.items };
}

/** Rows of a report table as trimmed cell texts (header excluded). */
async function tableRows(page: Page, region: string): Promise<string[][]> {
  const rows = page.getByRole('region', { name: region }).last().getByRole('row').filter({ has: page.getByRole('cell') });
  const out: string[][] = [];
  for (const row of await rows.all()) out.push((await row.getByRole('cell').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()));
  return out;
}

/** Minimal RFC 4180 parser: quoted fields may contain commas, quotes ("") and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ''));
}

test.describe('Report sections', () => {
  test('REP-005 documents report lists every envelope with its recipients and progress', async ({ page }) => {
    const { docs } = await apiData(page);
    requireData(docs.length > 0, 'no envelope in the last 12 months (API)');
    await page.goto(`/reports?section=documents&range=${RANGE}`);
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Documents report' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Documents report' }).last().getByRole('columnheader')).toHaveText(['Document', 'Recipients', 'Signed', 'Status', 'Updated', 'Progress']);

    const rows = await tableRows(page, 'Documents report');
    const byEnv = new Map(rows.map((cells) => [cells[0].match(/ENV-[0-9A-F]{8}/)?.[0], cells]));
    expect([...byEnv.keys()].sort(), 'report rows vs documents API').toEqual(docs.map((d) => envId(d.id)).sort());
    for (const d of docs) {
      const [document, recipients, signed, , , progress] = byEnv.get(envId(d.id))!;
      expect(document, envId(d.id)).toContain(d.title);
      expect(recipients, `${envId(d.id)} recipients`).toBe(String(d.recipients_total));
      expect(signed, `${envId(d.id)} signed`).toBe(String(d.recipients_completed));
      const pct = d.recipients_total ? Math.round((100 * d.recipients_completed) / d.recipients_total) : 0;
      expect(progress, `${envId(d.id)} progress`).toBe(`${pct}%`);
    }
  });

  test('REP-005 templates report lists every template with its uses, fields and owner', async ({ page }) => {
    const { templates } = await apiData(page);
    requireData(templates.length > 0, 'the workspace has no template (API)');
    await page.goto(`/reports?section=templates&range=${RANGE}`);
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Templates report' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Templates report' }).last().getByRole('columnheader')).toHaveText(['Template', 'Uses', 'Fields', 'Owner', 'Updated']);

    const rows = await tableRows(page, 'Templates report');
    const byTpl = new Map(rows.map((cells) => [cells[0].match(/TPL-[0-9A-F]{6}/)?.[0], cells]));
    expect([...byTpl.keys()].sort(), 'report rows vs templates API').toEqual(templates.map((t) => tplId(t.id)).sort());
    for (const t of templates) {
      const [template, uses, fields, owner] = byTpl.get(tplId(t.id))!;
      expect(template).toContain(t.title);
      expect(uses, `${tplId(t.id)} uses`).toBe(String(t.use_count));
      expect(fields, `${tplId(t.id)} fields`).toBe(String(t.field_count));
      expect(owner, `${tplId(t.id)} owner`).toBe(t.owner_name);
    }
    await expect(page.getByText(/^Showing \d+ templates?$/)).toHaveText(`Showing ${templates.length} template${templates.length === 1 ? '' : 's'}`);
  });

  test('BUG-37 report status column matches the envelope status', knownBug(KNOWN_BUGS.BUG37), async ({ page }) => {
    expectOpenBugsToFail();
    const { docs } = await apiData(page);
    requireData(docs.length > 0, 'no envelope in the last 12 months (API)');
    await page.goto(`/reports?section=documents&range=${RANGE}`);
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Documents report' })).toBeVisible();
    const status = new Map((await tableRows(page, 'Documents report')).map((c) => [c[0].match(/ENV-[0-9A-F]{8}/)?.[0], c[3]]));
    /* The library and the report's own CSV use the API status ("prepared" → "Prepared"). */
    const mismatches = docs.filter((d) => status.get(envId(d.id))?.toLowerCase() !== d.status.toLowerCase()).map((d) => `${envId(d.id)}: report "${status.get(envId(d.id))}", envelope "${d.status}"`);
    expect(mismatches).toEqual([]);
  });

  test('REP-009 all reports downloads all six standard CSV exports with matching data', async ({ page }) => {
    const { docs, templates } = await apiData(page);
    await page.goto(`/reports?section=all&range=${RANGE}`);
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 2, name: 'All reports' })).toBeVisible();

    const reports = [
      { name: 'Documents report', file: 'documents', header: 'document_id,title,status,signed,total,age_days,sender_name,updated_at' },
      { name: 'Templates report', file: 'templates', header: 'template_id,title,use_count,completed_copies,field_count,owner_name,updated_at' },
      { name: 'Templates usage report', file: 'template_usage', header: 'template_id,title,use_count,completed_copies,field_count,owner_name,updated_at' },
      { name: 'Completed copies report', file: 'completed_copies', header: 'template_id,title,completed_copies' },
      { name: 'Recipients report', file: 'recipients', header: 'email,sent,delivered,viewed,completed,declined,expired,median_completion_seconds,median_completion_label,completion_rate_pct' },
      { name: 'Audit export', file: 'audit', header: 'created_at,document_id,event_type,event_message,ip_address,user_agent' },
    ];
    const cards = page.getByRole('button', { name: /CSV · Last 12 months$/ });
    await expect(cards).toHaveCount(reports.length);

    const csv: Record<string, string[][]> = {};
    for (const { name, file, header } of reports) {
      const card = page.getByRole('button', { name: new RegExp(`^${name} .*CSV · Last 12 months$`) });
      let download!: Download;
      /* A click before hydration is dropped (R3): retry until the download starts. */
      await expect(async () => {
        [download] = await Promise.all([page.waitForEvent('download', { timeout: 5_000 }), card.click()]);
      }, `"${name}" did not download`).toPass({ timeout: 30_000 });
      expect(download.suggestedFilename(), name).toBe(`${file}-${RANGE}.csv`);
      const rows = parseCsv(await readFile(await download.path(), 'utf8'));
      expect(rows[0]?.join(','), `${name} header`).toBe(header);
      rows.slice(1).forEach((r, i) => expect(r.length, `${name} row ${i + 1} column count`).toBe(rows[0].length));
      csv[file] = rows.slice(1);
    }

    /* Content cross-checks against the API. */
    expect(csv.documents.map((r) => r[0]).sort(), 'documents CSV vs documents API').toEqual(docs.map((d) => d.id).sort());
    for (const d of docs) {
      const row = csv.documents.find((r) => r[0] === d.id)!;
      expect([row[1], row[2], row[3], row[4]], `documents CSV ${d.id}`).toEqual([d.title, d.status, String(d.recipients_completed), String(d.recipients_total)]);
    }
    for (const file of ['templates', 'template_usage', 'completed_copies']) {
      expect(csv[file].map((r) => r[0]).sort(), `${file} CSV vs templates API`).toEqual(templates.map((t) => t.id).sort());
    }
    for (const t of templates) {
      const row = csv.templates.find((r) => r[0] === t.id)!;
      expect([row[1], row[2], row[4], row[5]], `templates CSV ${t.id}`).toEqual([t.title, String(t.use_count), String(t.field_count), t.owner_name]);
    }
    const knownDocs = new Set(docs.map((d) => d.id));
    expect(csv.audit.length, 'audit export has no events').toBeGreaterThan(0);
    for (const r of csv.audit) expect(r[0], 'audit created_at').toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    expect(csv.audit.some((r) => knownDocs.has(r[1])), 'audit export mentions none of the current documents').toBe(true);
  });

  test('REP-010 analytics scorecards agree with the library and templates', async ({ page }) => {
    const { docs, templates } = await apiData(page);
    await page.goto(`/reports?range=${RANGE}`);
    await waitForHydration(page);
    const card = async (name: string) => textsIn(page.getByRole('region', { name: 'Report summary' }).getByRole('article', { name }), 'p');
    const completed = docs.filter((d) => d.status === 'completed').length;
    expect(await card('Documents created'), 'documents created in the period vs API').toEqual(expect.arrayContaining(['Documents created', String(docs.length)]));
    expect((await card('Completion rate'))[2], 'completion denominator vs API').toBe(`${completed} of ${docs.length} documents`);
    expect((await card('Templates created'))[1], 'templates vs API').toBe(String(templates.length));
    expect((await card('Templates created'))[2], 'template uses vs API').toBe(`${templates.reduce((n, t) => n + t.use_count, 0)} uses`);
  });

  test('BUG-45 REP-010 invite figures count only envelopes that were sent', knownBug(KNOWN_BUGS.BUG45), async ({ page }) => {
    expectOpenBugsToFail();
    const docs = ((await (await page.request.get(API.documents)).json()) as { sent_at: string | null; completed_at: string | null; created_at: string }[])
      .filter((d) => Date.now() - Date.parse(d.created_at) <= YEAR_MS);
    const sent = docs.filter((d) => d.sent_at).length;
    const pending = docs.filter((d) => d.sent_at && !d.completed_at).length;
    await page.goto(`/reports?range=${RANGE}`);
    await waitForHydration(page);
    const total = page.getByText('Total sent invites', { exact: true }).locator('xpath=following-sibling::*[1]');
    await expect(total, `only ${sent} envelope(s) were sent (API sent_at)`).toHaveText(String(sent));
    const outcomes = page.getByRole('list', { name: 'Invites by outcome' }).getByRole('listitem');
    await expect(outcomes.filter({ hasText: /^Pending \/ expired/ }).locator('strong'), 'pending invites must be sent ones').toHaveText(String(pending));
  });

  test('custom report builder adds a dimension as a column', async ({ page }) => {
    await page.goto('/reports?section=custom');
    await waitForHydration(page);
    const dimensions = page.getByRole('group', { name: 'Available dimensions' });
    await expect(dimensions.getByRole('button')).toHaveCount(9);
    await expect(page.getByText('Pick dimensions above to compose a report.')).toBeVisible();

    await dimensions.getByRole('button', { name: 'Envelope status' }).click();
    await expect(page.getByText('Pick dimensions above to compose a report.')).toBeHidden();
    for (const action of ['Save definition', 'Schedule weekly', 'Run report']) {
      await expect(page.getByRole('button', { name: action })).toBeVisible();
    }
  });
});
