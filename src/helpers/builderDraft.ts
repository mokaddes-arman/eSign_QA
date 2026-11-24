import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { API } from './api';
import { requireData } from './precondition';
import { signatureRequestsLeft } from './quota';

/**
 * The fixed draft every builder, workflow, signer-preview and builder-bug spec works on.
 *
 * Until 23 Nov 2026 those specs opened "Continue your most recent draft". Every draft created
 * before the 20 Nov deploy has lost its PDF (BUG-34), so nothing could be placed or previewed.
 * The suite now keeps ONE named draft whose PDF loads, and re-creates it (one upload, one
 * signature request) only when it is missing or its PDF stops loading. Specs still revert
 * every change they make to it; seeded fields are restored when a draft is found empty.
 */
export const BUILDER_DRAFT = 'QA Builder draft';

/** Fields the draft starts with, all for Recipient 1. Text Inputs are left to the specs that add and remove them. */
export const BUILDER_FIELDS = ['Signature', 'Full Name', 'Date Signed', 'Checkbox'] as const;

const SAMPLE_DOC = path.resolve(__dirname, '../../tests/fixtures/sample-agreement.png');

type ApiDocument = { id: string; title: string; is_template: boolean; deleted_at: string | null; archived_at: string | null; updated_at: string };

/** GET /documents/{id}/pdf answers 200 application/pdf. */
export async function pdfLoads(page: Page, id: string): Promise<boolean> {
  const response = await page.request.get(`${API.document(id)}/pdf`);
  return response.ok() && /application\/pdf/.test(response.headers()['content-type'] ?? '');
}

/** Id of the fixed builder draft, uploading and naming a new one if none with a loadable PDF exists. */
export async function ensureBuilderDraft(page: Page): Promise<string> {
  const response = await page.request.get(API.documents);
  /* A signed-out session (e.g. superseded by another sign-in) answers with an error object, not a list. */
  expect(response.ok(), `GET ${API.documents} answered ${response.status()} — is the saved session still signed in?`).toBe(true);
  const docs = (await response.json()) as ApiDocument[];
  const candidates = docs
    .filter((d) => d.title === BUILDER_DRAFT && !d.is_template && !d.deleted_at && !d.archived_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const d of candidates) if (await pdfLoads(page, d.id)) return d.id;

  const quota = await signatureRequestsLeft(page.request);
  requireData(quota.left > 0, `the fixed builder draft "${BUILDER_DRAFT}" is missing and no signature request is left to upload it (${quota.plan})`);
  await page.goto('/documents/prepare', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.locator('input[type=file]').first().setInputFiles(SAMPLE_DOC);
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/prepare/, { timeout: 60_000 });
  const id = /\/documents\/([0-9a-f-]{36})\//.exec(page.url())![1];
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

  const rename = page.getByRole('button', { name: /^Rename document · / });
  const name = page.getByRole('textbox', { name: 'Document name' });
  await expect(async () => {
    if (!(await name.isVisible().catch(() => false))) await rename.click();
    await expect(name).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await name.fill(BUILDER_DRAFT);
  await name.press('Enter');
  await expect(rename).toHaveAttribute('aria-label', `Rename document · ${BUILDER_DRAFT}`);
  return id;
}

/**
 * Places any seed field type the draft is missing (first use, or after an interrupted spec's
 * cleanup removed a recipient together with its fields). Expects the builder to be open on the draft.
 */
export async function seedBuilderFields(page: Page): Promise<void> {
  const counter = page.getByText(/^\d+ fields? · autosaved$/);
  await expect(counter).toBeVisible({ timeout: 20_000 });
  const count = async () => Number((await counter.innerText()).match(/^\d+/)![0]);
  const palette = page.getByRole('region', { name: 'Field palette' });
  let placed = false;
  for (const field of BUILDER_FIELDS) {
    if ((await page.getByRole('button', { name: new RegExp(`^${field} for .+, (required|optional)`) }).count()) > 0) continue;
    const before = await count();
    const tile = palette.getByRole('button', { name: new RegExp(`^Place ${field} —`) });
    await tile.focus();
    await tile.press('Enter');
    await expect.poll(count, { message: `placing ${field} did not add a field`, timeout: 15_000 }).toBe(before + 1);
    placed = true;
  }
  /* Autosave is debounced; let it reach the server before the spec reloads or leaves. */
  if (placed) {
    await page.waitForTimeout(1_500);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  }
}
