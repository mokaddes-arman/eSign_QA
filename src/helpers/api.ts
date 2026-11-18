import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Backend routes the web app calls through its same-origin proxy (discovered from
 * the browser's network traffic on 17 Nov 2026). Authentication is the
 * `sf_session` cookie from the saved storage state; anonymous calls are
 * redirected to /login with 307.
 */
export const API = {
  me: '/api/proxy/me',
  documents: '/api/proxy/documents',
  document: (id: string) => `/api/proxy/documents/${id}`,
  contacts: '/api/proxy/contacts',
  billingUsage: '/api/proxy/billing/usage',
  webhooks: '/api/proxy/webhooks',
  webhookEventTypes: '/api/proxy/webhooks/event-types',
} as const;

/** Read-only endpoints used for access-control and timing checks. GET only. */
export const READ_ENDPOINTS = [API.me, API.documents, API.contacts, API.billingUsage, API.webhooks, API.webhookEventTypes];

/** A syntactically valid UUID that belongs to nobody. */
export const FOREIGN_ID = '00000000-0000-4000-8000-000000000000';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field names that must never reach the browser in an API payload. */
export const SENSITIVE_KEY = /password|passwd|hash|secret|token|api_?key|private|otp|salt/i;

export interface TimedResponse {
  response: APIResponse;
  ms: number;
}

/** GET without following redirects, with wall-clock latency. */
export async function timedGet(request: APIRequestContext, url: string): Promise<TimedResponse> {
  const started = Date.now();
  const response = await request.get(url, { maxRedirects: 0 });
  return { response, ms: Date.now() - started };
}

/** Every key (recursively) of a JSON value — used to scan payloads for sensitive fields. */
export function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** Nearest-rank percentile of a list of numbers. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
