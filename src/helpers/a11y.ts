import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

/** WCAG 2.1 A + AA rule set (the level agreed in TEST_PLAN §4: "Accessibility"). */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * axe rules whose violations are already tracked as a known bug (with its own @bug
 * test). They are annotated, not counted as blocking, so the page scans keep
 * catching NEW violations instead of failing forever on a reported one.
 */
export const KNOWN_AXE_RULES: Record<string, string> = {
  'label-content-name-mismatch': 'BUG-19',
};

export interface AxeSummary {
  violations: { id: string; impact: string | null; help: string; nodes: number; sample: string }[];
  blocking: number;
}

/**
 * Runs axe-core against the current page and attaches the full result to the
 * report. `blocking` counts the violations with impact critical or serious;
 * moderate/minor findings are recorded but do not fail the scan.
 */
export async function scanAccessibility(page: Page, testInfo: TestInfo, exclude: string[] = []): Promise<AxeSummary> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const selector of exclude) builder = builder.exclude(selector);
  const result = await builder.analyze();

  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    nodes: v.nodes.length,
    sample: v.nodes[0]?.target.join(' ') ?? '',
  }));
  await testInfo.attach('axe-violations.json', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  for (const v of violations) {
    const known = KNOWN_AXE_RULES[v.id];
    testInfo.annotations.push({
      type: known ? 'issue' : `axe:${v.impact}`,
      description: `${known ? `${known} (known) ` : ''}${v.id} (${v.nodes} nodes) — ${v.help}`,
    });
  }
  const blocking = violations.filter((v) => (v.impact === 'critical' || v.impact === 'serious') && !KNOWN_AXE_RULES[v.id]);
  return { violations, blocking: blocking.length };
}

/** Human-readable list for assertion messages. */
export function describeViolations(summary: AxeSummary, impacts = ['critical', 'serious']): string {
  return summary.violations
    .filter((v) => impacts.includes(v.impact ?? '') && !KNOWN_AXE_RULES[v.id])
    .map((v) => `[${v.impact}] ${v.id} × ${v.nodes} — ${v.help} (e.g. ${v.sample})`)
    .join('\n');
}
