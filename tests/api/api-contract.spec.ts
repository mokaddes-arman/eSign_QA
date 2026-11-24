import { test, expect } from '../../src/fixtures/test';
import { requireData, requireEnv } from '../../src/helpers/precondition';
import { API, EMAIL, FOREIGN_ID, ISO_DATE, SENSITIVE_KEY, UUID, allKeys, timedGet } from '../../src/helpers/api';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/*
 * API contract checks for the backend the web app calls (`/api/proxy/*`).
 * Read-only: GET requests only, authenticated by the saved session cookie.
 * Case ids: API-001…API-010 (docs/TEST_CASES.md §17).
 */
const DOCUMENT_STATUSES = ['draft', 'prepared', 'sent', 'in_progress', 'waiting', 'completed', 'declined', 'voided', 'expired'];
const CONTACT_GROUPS = ['customers', 'internal', 'counsel', 'vendors'];

test.describe('API · contract @api', () => {
  test('API-001 /me returns the signed-in user without sensitive fields @smoke', async ({ request }) => {
    const { response } = await timedGet(request, API.me);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const me = await response.json();

    expect(me.id).toMatch(UUID);
    expect(me.organization_id).toMatch(UUID);
    expect(me.email).toMatch(EMAIL);
    expect(typeof me.name).toBe('string');
    expect(['admin', 'member', 'owner', 'viewer']).toContain(me.role);
    expect(me.email_verified_at, 'verified account').toMatch(ISO_DATE);
    expect(allKeys(me).filter((k) => SENSITIVE_KEY.test(k) && !/^mfa_/.test(k))).toEqual([]);
    /* Latency is measured by PERF-003 in the quiet serial project, not here. */
  });

  test('API-002 /documents lists envelopes with a consistent shape', async ({ request }) => {
    const response = await request.get(API.documents);
    expect(response.status()).toBe(200);
    const documents = await response.json();
    expect(Array.isArray(documents)).toBe(true);

    const me = await (await request.get(API.me)).json();
    for (const doc of documents) {
      expect(doc.id).toMatch(UUID);
      expect(doc.organization_id, 'tenant isolation: every document belongs to my organization').toBe(me.organization_id);
      expect(typeof doc.title).toBe('string');
      expect(doc.title.length).toBeGreaterThan(0);
      expect(DOCUMENT_STATUSES).toContain(doc.status);
      expect(doc.page_count).toBeGreaterThanOrEqual(1);
      expect(doc.created_at).toMatch(ISO_DATE);
      expect(Date.parse(doc.updated_at)).toBeGreaterThanOrEqual(Date.parse(doc.created_at));
      expect(doc.recipients_completed).toBeGreaterThanOrEqual(0);
      expect(doc.recipients_completed).toBeLessThanOrEqual(doc.recipients_total);
      if (doc.original_sha256) expect(doc.original_sha256).toMatch(/^[0-9a-f]{64}$/);
      /* A document that is not completed cannot carry a completion time or a sealed hash. */
      if (doc.status !== 'completed') {
        expect(doc.completed_at).toBeNull();
        expect(doc.final_sha256).toBeNull();
      }
    }
  });

  test('API-003 a document is readable by id and matches the list entry', async ({ request }) => {
    const documents = await (await request.get(API.documents)).json();
    requireData(documents.length > 0, 'the workspace has no documents (GET /api/proxy/documents is empty)');
    const first = documents[0];

    const response = await request.get(API.document(first.id));
    expect(response.status()).toBe(200);
    const doc = await response.json();
    expect(doc.id).toBe(first.id);
    expect(doc.title).toBe(first.title);
    expect(doc.status).toBe(first.status);
  });

  test('API-004 unknown document id returns 404 with a clean message', async ({ request }) => {
    const response = await request.get(API.document(FOREIGN_ID));
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.detail).toMatch(/not found/i);
    expect(JSON.stringify(body), 'no stack trace or SQL in the error').not.toMatch(/Traceback|Exception|SELECT |at \w+\.\w+ \(/);
  });

  test('API-005 malformed document id is rejected without a server error', async ({ request }) => {
    for (const id of ['not-a-uuid', "1' OR '1'='1", '%00', '9'.repeat(300)]) {
      const response = await request.get(API.document(encodeURIComponent(id)));
      expect(response.status(), `GET documents/${id.slice(0, 20)}`).toBeGreaterThanOrEqual(400);
      expect(response.status(), `GET documents/${id.slice(0, 20)} must not be a 5xx`).toBeLessThan(500);
      expect(await response.text()).not.toMatch(/Traceback|psycopg|SQLSTATE|syntax error at or near/i);
    }
  });

  test('API-006 /contacts returns items, a total and group counts that agree', async ({ request }) => {
    const response = await request.get(API.contacts);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(body.items.length);

    for (const contact of body.items) {
      expect(contact.id).toMatch(UUID);
      expect(contact.email).toMatch(EMAIL);
      expect(contact.envelope_count).toBeGreaterThanOrEqual(0);
      if (contact.group) expect(CONTACT_GROUPS).toContain(String(contact.group).toLowerCase());
    }
    /* Group counts must add up to the per-group totals in items. */
    if (body.counts && typeof body.counts === 'object') {
      for (const group of CONTACT_GROUPS) {
        const key = Object.keys(body.counts).find((k) => k.toLowerCase() === group);
        if (!key) continue;
        const actual = body.items.filter((c: { group?: string }) => String(c.group).toLowerCase() === group).length;
        expect(body.counts[key], `counts.${key}`).toBe(actual);
      }
    }
  });

  test('API-007 billing usage arithmetic is internally consistent', async ({ request }) => {
    const response = await request.get(API.billingUsage);
    expect(response.status()).toBe(200);
    const usage = await response.json();

    expect(usage.plan_code).toMatch(/^(free|team|business|enterprise)$/);
    expect(Date.parse(usage.period_end)).toBeGreaterThan(Date.parse(usage.period_start));
    for (const [name, limit] of Object.entries<Record<string, number | boolean>>(usage.limits)) {
      const { limit: max, used, remaining, exceeded } = limit as { limit: number; used: number; remaining: number; exceeded: boolean };
      /* Per-item caps (e.g. max_recipients_per_document) are not consumed per period: remaining is null. */
      if (typeof max !== 'number' || remaining === null) continue;
      expect(used, `${name}.used`).toBeGreaterThanOrEqual(0);
      expect(remaining, `${name}.remaining = max(limit − used, 0)`).toBe(Math.max(max - used, 0));
      expect(exceeded, `${name}.exceeded ⇔ used ≥ limit`).toBe(used >= max);
    }
  });

  test('API-008 webhook event catalogue lists documented events', async ({ request }) => {
    const response = await request.get(API.webhookEventTypes);
    expect(response.status()).toBe(200);
    const types = await response.json();
    const names = types.map((t: { event_type: string }) => t.event_type);
    expect(names).toEqual(expect.arrayContaining(['document.completed', 'document.created']));
    for (const t of types) {
      expect(t.event_type).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(5);
    }
    expect(new Set(names).size, 'event types are unique').toBe(names.length);
  });

  test('API-009 HTTP TRACE is refused (no cross-site tracing)', async ({ request }) => {
    /* TRACE cannot change data, so it is safe against production; it must not be echoed. */
    const response = await request.fetch(API.me, { method: 'TRACE', maxRedirects: 0, timeout: 20_000 }).catch((error: Error) => {
      /* A server that drops TRACE without answering does not echo it either. */
      if (!/Timeout/.test(error.message)) throw error;
      test.info().annotations.push({ type: 'note', description: 'TRACE was not answered within 20 s (dropped, not echoed)' });
      return null;
    });
    if (response) {
      expect([400, 403, 404, 405, 501], `TRACE answered with ${response.status()}`).toContain(response.status());
      expect(await response.text(), 'TRACE must not echo the request (cookies)').not.toMatch(/sf_session=/);
    }
  });

  test('API-010 JSON responses are served with a JSON content type and no-sniff', async ({ request }) => {
    for (const url of [API.me, API.documents, API.contacts]) {
      const response = await request.get(url);
      expect(response.headers()['content-type'], url).toMatch(/^application\/json/);
      expect(response.headers()['x-content-type-options'], url).toBe('nosniff');
    }
  });
});

/*
 * BUG-34 — envelopes created before the 20 Nov 2026 deploy lost their stored PDF: the builder
 * and the signer view show "Document unavailable". The builder specs now use a fresh fixed
 * draft (src/helpers/builderDraft.ts), so this read-only check is what keeps the defect tracked.
 */
const DEPLOY_20_NOV = Date.parse('2026-11-20T15:00:00Z');

test.describe('API · stored documents', () => {
  test('BUG-34 every envelope PDF can be downloaded, including those created before the 20 Nov deploy', knownBug(KNOWN_BUGS.BUG34), async ({ request }) => {
    expectOpenBugsToFail();
    const docs = (await (await request.get(API.documents)).json()) as { id: string; title: string; created_at: string }[];
    const older = docs.filter((d) => Date.parse(d.created_at) < DEPLOY_20_NOV);
    requireData(older.length > 0, 'no envelope created before the 20 Nov 2026 deploy is left to check (API)');
    const broken: string[] = [];
    for (const d of docs) {
      const response = await request.get(`${API.document(d.id)}/pdf`);
      const type = response.headers()['content-type'] ?? '';
      if (!response.ok() || !/application\/pdf/.test(type)) broken.push(`${d.title} ${d.id.slice(0, 8)} (created ${d.created_at.slice(0, 10)}): ${response.status()} ${type}`);
    }
    expect(broken, `${broken.length} of ${docs.length} envelope PDFs do not load`).toEqual([]);
  });
});
