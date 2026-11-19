import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { expectUploadRefused, signatureRequestsLeft } from '../../src/helpers/quota';

/*
 * Upload → draft → builder (DOC-009, PREP-002) and the quota-exhausted refusal (DOC-022).
 *
 * Quota-aware, never skipped: every new draft consumes a signature request.
 *   requests left  → upload, verify the builder opens on a NEW draft, then delete that
 *                    draft by its id (titles repeat, ids do not), so the library is unchanged
 *   none left      → the upload must be refused with upgrade guidance and no draft created
 * Runs in the serial `chromium-account` project, because a new draft becomes the
 * "most recent draft" that the builder tests reuse.
 */
const SAMPLE_DOC = path.resolve(__dirname, '../fixtures/sample-agreement.png');

test.describe('Documents · upload (quota-aware) @quota', () => {
  /* Every document that did not exist before the test is trashed in afterEach — which runs
     even when the test times out, and catches a draft created before its id was read.
     A leaked draft would become the builder tests' "most recent draft". This spec runs
     alone in the serial chromium-account project, so no other test creates drafts meanwhile. */
  let existing = new Set<string>();
  const created: string[] = [];
  test.beforeEach(async ({ request }) => {
    existing = new Set(((await (await request.get(API.documents)).json()) as { id: string }[]).map((d) => d.id));
  });
  test.afterEach(async ({ documentsPage, request }) => {
    const now = ((await (await request.get(API.documents)).json()) as { id: string }[]).map((d) => d.id);
    for (const id of new Set([...created, ...now.filter((id) => !existing.has(id))])) {
      if (now.includes(id)) await documentsPage.deleteDocument(id);
    }
    created.length = 0;
  });

  test('DOC-009 / DOC-022 library "Upload & prepare" creates a draft, or is refused when the quota is used up', async ({ documentsPage, page, request }) => {
    const docsBefore: { id: string }[] = await (await request.get(API.documents)).json();
    const quota = await signatureRequestsLeft(request);
    test.info().annotations.push({ type: 'quota', description: `${quota.left} of ${quota.limit} signature requests left (${quota.plan})` });
    await documentsPage.goto();

    if (quota.left === 0) {
      await documentsPage.chooseUploadFile(SAMPLE_DOC);
      await expectUploadRefused(page, request, /\/documents(\?|$)/, docsBefore.length);
      return;
    }

    await documentsPage.uploadDocument(SAMPLE_DOC);
    const id = /\/documents\/([0-9a-f-]{36})\//.exec(page.url())?.[1];
    expect(id, 'The builder URL carries the new document id').toBeTruthy();
    created.push(id!);
    {
      await expect(page.getByRole('heading', { name: 'Prepare document' })).toBeVisible();
      expect(docsBefore.map((d) => d.id), 'The upload created a NEW draft').not.toContain(id);
      expect((await signatureRequestsLeft(request)).left, 'The new draft consumed one signature request').toBe(quota.left - 1);
    }
  });

  test('PREP-002 / DOC-022 "Choose a file" on New envelope opens the builder, or is refused when the quota is used up', async ({ preparePage, documentsPage, page, request }) => {
    const docsBefore: { id: string }[] = await (await request.get(API.documents)).json();
    const quota = await signatureRequestsLeft(request);
    test.info().annotations.push({ type: 'quota', description: `${quota.left} of ${quota.limit} signature requests left (${quota.plan})` });
    await preparePage.goto();

    if (quota.left === 0) {
      await preparePage.fileInput.setInputFiles(SAMPLE_DOC);
      await expectUploadRefused(page, request, /\/documents\/prepare/, docsBefore.length);
      return;
    }

    await preparePage.upload(SAMPLE_DOC);
    const id = preparePage.documentIdFromUrl();
    created.push(id);
    {
      expect(docsBefore.map((d) => d.id), 'The upload created a NEW draft').not.toContain(id);
      await preparePage.waitForCanvas();
    }
  });
});
