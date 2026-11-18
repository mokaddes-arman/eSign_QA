import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API } from './api';

/** Signature requests left this period (each new draft consumes one). */
export async function signatureRequestsLeft(request: APIRequestContext): Promise<{ left: number; limit: number; plan: string }> {
  const usage = await (await request.get(API.billingUsage)).json();
  const q = usage.limits.max_documents_per_month;
  return { left: q.remaining ?? Math.max(q.limit - q.used, 0), limit: q.limit, plan: usage.plan_code };
}

/**
 * Quota-exhausted branch of an upload test (DOC-022): the upload must be refused with
 * guidance to upgrade, no draft may be created, and the user stays where they were.
 */
export async function expectUploadRefused(page: Page, request: APIRequestContext, startUrl: RegExp, docsBefore: number): Promise<void> {
  await expect(page, 'With no signature requests left the upload must not open the builder').toHaveURL(startUrl);
  await expect(
    page.getByText(/limit|quota|upgrade|signature requests|no requests left/i).first(),
    'The refusal should explain the monthly limit and how to upgrade',
  ).toBeVisible({ timeout: 15_000 });
  const docsAfter = (await (await request.get(API.documents)).json()).length;
  expect(docsAfter, 'A refused upload must not create a draft').toBe(docsBefore);
}
