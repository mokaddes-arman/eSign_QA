import { test, expect } from '../../src/fixtures/test';
import { API, READ_ENDPOINTS, percentile, timedGet } from '../../src/helpers/api';
import { KNOWN_BUGS, expectOpenBugsToFail, knownBug } from '../../src/helpers/bugs';

/*
 * Performance smoke (NF-012) — single-user budgets measured in the browser via the
 * Navigation Timing API, and API latency from the test runner. This is NOT load
 * testing: the target is the live production deployment, so concurrency is capped
 * at 10 read-only requests. Load / stress / soak tests need a staging environment
 * and JMeter or k6 (see QA_Summary.md).
 *
 * Run alone (npm run test:perf → --workers=1) so our own parallel tests do not skew the timings;
 * each measurement is independent, so one breach does not hide the others.
 *
 * Budgets: TTFB ≤ 1.5 s, DOMContentLoaded ≤ 3 s, load ≤ 5 s, API p95 ≤ 1.5 s.
 * Case ids PERF-001…PERF-005 (docs/TEST_CASES.md §17).
 */
const BUDGET = { ttfb: 1_500, dcl: 3_000, load: 5_000, apiP95: 1_500, burstMax: 4_000 };

type NavTiming = { ttfb: number; dcl: number; load: number; transferKb: number; requests: number };

async function measure(page: import('@playwright/test').Page, path: string): Promise<NavTiming> {
  await page.goto(path, { waitUntil: 'load' });
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      ttfb: Math.round(nav.responseStart - nav.startTime),
      dcl: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      load: Math.round(nav.loadEventEnd - nav.startTime),
      transferKb: Math.round((nav.transferSize + resources.reduce((s, r) => s + (r.transferSize || 0), 0)) / 1024),
      requests: resources.length + 1,
    };
  });
}

async function record(testInfo: import('@playwright/test').TestInfo, name: string, data: unknown) {
  await testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  testInfo.annotations.push({ type: 'perf', description: `${name}: ${JSON.stringify(data)}` });
}

test.describe('Performance · page load budgets @perf', () => {

  test.describe('guest pages', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const path of ['/', '/login', '/pricing']) {
      test(`PERF-001 ${path} loads within budget`, knownBug(KNOWN_BUGS.BUG24), async ({ page }, testInfo) => {
        expectOpenBugsToFail();
        const t = await measure(page, path);
        await record(testInfo, `timing ${path}`, t);
        expect.soft(t.ttfb, 'TTFB').toBeLessThanOrEqual(BUDGET.ttfb);
        expect.soft(t.dcl, 'DOMContentLoaded').toBeLessThanOrEqual(BUDGET.dcl);
        expect.soft(t.load, 'load').toBeLessThanOrEqual(BUDGET.load);
      });
    }
  });

  for (const path of ['/overview', '/documents', '/contacts', '/reports', '/account/billing']) {
    test(`PERF-002 ${path} loads within budget`, knownBug(KNOWN_BUGS.BUG24), async ({ page }, testInfo) => {
      expectOpenBugsToFail();
      const t = await measure(page, path);
      await record(testInfo, `timing ${path}`, t);
      expect(page.url(), 'still signed in').not.toMatch(/\/login/);
      expect.soft(t.ttfb, 'TTFB').toBeLessThanOrEqual(BUDGET.ttfb);
      expect.soft(t.dcl, 'DOMContentLoaded').toBeLessThanOrEqual(BUDGET.dcl);
      expect.soft(t.load, 'load').toBeLessThanOrEqual(BUDGET.load);
    });
  }
});

test.describe('Performance · API latency @perf', () => {

  test('PERF-003 read endpoints answer within the p95 budget', async ({ request }, testInfo) => {
    const results: Record<string, { p50: number; p95: number; max: number }> = {};
    for (const url of READ_ENDPOINTS) {
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const { response, ms } = await timedGet(request, url);
        expect(response.status(), url).toBe(200);
        samples.push(ms);
      }
      results[url] = { p50: percentile(samples, 50), p95: percentile(samples, 95), max: Math.max(...samples) };
    }
    await record(testInfo, 'api-latency-ms', results);
    for (const [url, r] of Object.entries(results)) expect(r.p95, `${url} p95`).toBeLessThanOrEqual(BUDGET.apiP95);
  });

  test('PERF-004 burst of 10 concurrent reads all succeed (concurrency smoke)', async ({ request }, testInfo) => {
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 10 }, () => timedGet(request, API.me)));
    const times = results.map((r) => r.ms);
    await record(testInfo, 'burst-10', { wallMs: Date.now() - started, p50: percentile(times, 50), p95: percentile(times, 95), max: Math.max(...times) });
    expect(results.map((r) => r.response.status())).toEqual(Array(10).fill(200));
    expect(Math.max(...times), 'slowest request in the burst').toBeLessThanOrEqual(BUDGET.burstMax);
  });

  test('PERF-005 the app recovers after a burst (no lingering slowdown)', async ({ request }, testInfo) => {
    await Promise.all(Array.from({ length: 10 }, () => timedGet(request, API.documents)));
    const after: number[] = [];
    for (let i = 0; i < 3; i++) after.push((await timedGet(request, API.me)).ms);
    await record(testInfo, 'post-burst-ms', after);
    expect(percentile(after, 50), 'median latency right after the burst').toBeLessThanOrEqual(BUDGET.apiP95);
  });
});
