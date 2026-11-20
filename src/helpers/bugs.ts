import { test, type TestDetails } from '@playwright/test';

/**
 * A defect reported against eSignPro that has a dedicated reproduction test.
 *
 * Bug tests assert the *correct* behaviour, so they fail while the defect is
 * present and start passing once it is fixed. The dashboard reporter lists them
 * on the "Known bugs" tab as `open` (still reproduces) or `not reproduced`.
 *
 * KNOWN_BUGS=expect-fail wraps them in `test.fail()` so a pipeline can stay green
 * while the defects are open; a fixed bug then shows up as an unexpected pass.
 */
export interface KnownBug {
  /** Stable id used in docs/TEST_CASES.md §15 and bug reports, e.g. "BUG-01". */
  id: string;
  /** S1 Blocker … S4 Minor (TEST_PLAN §12). */
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  /** One line, as reported. */
  summary: string;
  /** What the product should do instead. */
  expected: string;
  /** Matching test-case id in TEST_CASES.md. */
  caseId: string;
}

export const KNOWN_BUGS = {
  BUG01: {
    id: 'BUG-01',
    severity: 'S3',
    summary: 'Field label/placeholder text is unreadable when the document page has a black background',
    expected: 'Field text keeps ≥ 3:1 contrast on both light and dark document pages',
    caseId: 'PREP-019',
  },
  BUG02: {
    id: 'BUG-02',
    severity: 'S4',
    summary: 'Favouriting a field does not move it to the top of the field palette',
    expected: 'Favourited fields are listed before all other fields in "All fields"',
    caseId: 'PREP-020',
  },
  BUG03: {
    id: 'BUG-03',
    severity: 'S3',
    summary: 'Preview cannot show how all recipients will see the document',
    expected: 'Preview offers an "All recipients" view (or every recipient) with each recipient\'s fields',
    caseId: 'SIGN-008',
  },
  BUG04: {
    id: 'BUG-04',
    severity: 'S3',
    summary: 'Opening another document while one is open in the builder shows no warning',
    expected: 'User is asked to confirm closing the current document before another one opens',
    caseId: 'PREP-021',
  },
  BUG05: {
    id: 'BUG-05',
    severity: 'S3',
    summary: 'Placeholder text set in the inspector is not shown on the editing canvas',
    expected: 'The canvas field shows its placeholder text while editing',
    caseId: 'PREP-022',
  },
  BUG06: {
    id: 'BUG-06',
    severity: 'S3',
    summary: 'Document-name character-limit error has wrong wording and is not shown in the error colour',
    expected: 'Over-long names are rejected with "…N characters…" wording rendered in the error colour',
    caseId: 'PREP-023',
  },
  BUG07: {
    id: 'BUG-07',
    severity: 'S2',
    summary: 'Template names are not unique',
    expected: 'Saving a template with an existing template name is rejected with a clear error',
    caseId: 'TPL-002',
  },
  BUG08: {
    id: 'BUG-08',
    severity: 'S3',
    summary: 'Missing-recipient error has wrong wording and wrong (warning) colour',
    expected: 'A missing recipient e-mail is a blocking error shown in the error colour with clear wording',
    caseId: 'WF-011',
  },
  BUG09: {
    id: 'BUG-09',
    severity: 'S4',
    summary: 'Recipients can be edited inline in several places (UX: remove the inline editor)',
    expected: 'Recipients are edited in one place (Manage recipients); other screens show them read-only',
    caseId: 'WF-012',
  },
  BUG10: {
    id: 'BUG-10',
    severity: 'S2',
    summary: 'Delete (and Archive) on a template does nothing — no request, no confirmation, template stays',
    expected: 'Delete removes the template (or moves it to Trash) after a confirmation, with feedback',
    caseId: 'TPL-004',
  },
  /* Candidate defects logged during the 13 Nov walkthrough (FEATURES.md §14). Earlier
     specs asserted the broken behaviour as "expected"; they are now tracked here. */
  BUG11: {
    id: 'BUG-11',
    severity: 'S3',
    summary: 'Submitting an empty support ticket gives no validation feedback (FEATURES O9)',
    expected: 'Required fields are flagged with an error message in the error colour',
    caseId: 'SUP-004',
  },
  BUG12: {
    id: 'BUG-12',
    severity: 'S4',
    summary: 'Organization section heading reads "People1" — count not separated (FEATURES O7)',
    expected: 'Heading reads "People" with the count visually and audibly separated',
    caseId: 'ACC-014',
  },
  BUG13: {
    id: 'BUG-13',
    severity: 'S4',
    summary: 'Trust-centre hero accessible name reads "eSignProhandles" (FEATURES O8)',
    expected: 'Accessible name keeps the space: "eSignPro handles"',
    caseId: 'AUTH-021',
  },
  BUG14: {
    id: 'BUG-14',
    severity: 'S4',
    summary: 'Change-plan dialog pre-selects Enterprise for a Free workspace (FEATURES O6)',
    expected: 'The current plan (Free) is pre-selected',
    caseId: 'BIL-002',
  },
  /* Found by the new UI layer on 16 Nov 2026. */
  BUG15: {
    id: 'BUG-15',
    severity: 'S4',
    summary: 'Registration validation error ("Name and company are required") is shown in neutral grey, not the error colour',
    expected: 'Form errors use the error colour, consistently with field errors',
    caseId: 'AUTH-004',
  },
  BUG16: {
    id: 'BUG-16',
    severity: 'S4',
    summary: 'Intermittent React hydration error #418 (server/client text mismatch) on Activity logs and the Trash folder',
    expected: 'Pages hydrate without uncaught errors',
    caseId: 'NF-006',
  },
  BUG17: {
    id: 'BUG-17',
    severity: 'S3',
    summary: 'Saving a new contact without a name does nothing — no message, field not flagged',
    expected: 'Full name is flagged as required with a visible error',
    caseId: 'CON-005',
  },
  /* Found by the coverage-gap tests on 17 Nov 2026 (qa-reports/QA_Bug_Report.xlsx). */
  BUG19: {
    id: 'BUG-19',
    severity: 'S4',
    summary: 'Label in Name (WCAG 2.5.3): logo link, global-search button and account avatar have accessible names that omit their visible text',
    expected: 'Each control’s accessible name contains its visible text (e.g. search name includes the visible label; avatar name includes "MS")',
    caseId: 'A11Y-001',
  },
  BUG20: {
    id: 'BUG-20',
    severity: 'S3',
    summary: 'Reflow (WCAG 1.4.10): sign-in and app shell are 360 px wide, so a 320 px viewport scrolls horizontally',
    expected: 'Content reflows to 320 CSS px without horizontal scrolling',
    caseId: 'A11Y-006',
  },
  BUG21: {
    id: 'BUG-21',
    severity: 'S4',
    summary: 'Password meter labels passwords that break the stated rule (11 chars, or no digit/capital/symbol) as "Strong" instead of keeping the "Use 12+ characters…" guidance',
    expected: 'A password that does not meet the rule is never labelled Strong; the meter keeps showing what is missing until "Excellent — meets…"',
    caseId: 'AUTH-026',
  },
  BUG22: {
    id: 'BUG-22',
    severity: 'S4',
    summary: 'Server software and version disclosed in response headers (Server: nginx/1.24.0 (Ubuntu), X-Powered-By: Next.js)',
    expected: 'No version in the Server header and no X-Powered-By header',
    caseId: 'SEC-003',
  },
  BUG23: {
    id: 'BUG-23',
    severity: 'S3',
    summary: 'Documents status filter "Drafts" returns 0 documents while the "Drafts" view lists every prepared draft (6)',
    expected: 'Filter by status = Drafts lists the same envelopes as the Drafts view',
    caseId: 'DOC-004',
  },
  BUG24: {
    id: 'BUG-24',
    severity: 'S3',
    summary: 'Slow first visit: static JS chunks served from the origin with ~1–1.8 s time-to-first-byte each (no CDN); cold page loads take 6–15 s',
    expected: 'Cold page load within budget (TTFB ≤ 1.5 s, DOMContentLoaded ≤ 3 s, load ≤ 5 s); immutable assets served from a CDN/edge cache',
    caseId: 'PERF-001',
  },
  BUG28: {
    id: 'BUG-28',
    severity: 'S3',
    summary: 'WebKit/Safari: after the report period is changed once, further period changes and section-tab clicks do nothing (Chromium and Firefox work)',
    expected: 'Report section tabs navigate in every browser, also after the period changed',
    caseId: 'REP-002',
  },
  BUG29: {
    id: 'BUG-29',
    severity: 'S3',
    summary: 'Archive view offers no "Unarchive": the row menu still says "Archive", and choosing it silently unarchives the document',
    expected: 'Archived documents offer an explicit "Unarchive" (or "Restore") action, as the archive confirmation promises',
    caseId: 'DOC-013',
  },
  BUG30: {
    id: 'BUG-30',
    severity: 'S2',
    summary: 'Trash has no Restore: neither the row menu nor the bulk bar can bring a deleted document back, although "Move to Trash" says it can be restored',
    expected: 'Documents in Trash offer "Restore", which returns them to the library',
    caseId: 'DOC-013',
  },
  BUG31: {
    id: 'BUG-31',
    severity: 'S3',
    summary: 'Contact "Add as recipient" adds the contact to whichever draft is newest without asking; the 2-second notice names no envelope and miscounts ("recipient 4" for the 2nd recipient)',
    expected: 'The user chooses the envelope (or is taken to it), and the confirmation names that envelope',
    caseId: 'CON-008',
  },
  BUG32: {
    id: 'BUG-32',
    severity: 'S4',
    summary: 'Folder names are not unique: "New folder" creates a second folder with an existing name',
    expected: 'A duplicate folder name is rejected with an inline error and no folder is created',
    caseId: 'DOC-008',
  },
  BUG33: {
    id: 'BUG-33',
    severity: 'S4',
    summary: 'Overview "Envelope volume · last 12 weeks" skips a week number (W34, W35, W36, W38 … W46) — the weeks are not consecutive',
    expected: 'Twelve consecutive ISO weeks ending with the latest week',
    caseId: 'OVR-003',
  },
  BUG34: {
    id: 'BUG-34',
    severity: 'S1',
    summary: 'Every envelope PDF fails to load: /api/proxy/documents/{id}/pdf returns 500, so the builder canvas and the signer view show "Document unavailable"',
    expected: 'The envelope PDF loads in the builder and the signer view',
    caseId: 'PREP-002',
  },
} as const satisfies Record<string, KnownBug>;

/** Fixed folder used by the duplicate-name check, so runs do not create a new name each time. */
export const UNIQUENESS_FOLDER = 'QA Folder (uniqueness check)';

/** Fixed template name used by the uniqueness check, so runs never pile up templates. */
export const UNIQUENESS_TEMPLATE = 'QA Template (uniqueness check)';

/** Tag + annotations for `test(title, knownBug(KNOWN_BUGS.BUG01), body)`. */
export function knownBug(bug: KnownBug, extraTags: string[] = []): TestDetails {
  return {
    tag: ['@bug', ...extraTags],
    annotation: [
      { type: 'bug', description: bug.id },
      { type: 'severity', description: bug.severity },
      { type: 'summary', description: bug.summary },
      { type: 'expected', description: bug.expected },
      { type: 'case', description: bug.caseId },
    ],
  };
}

export const expectBugsToFail = process.env.KNOWN_BUGS === 'expect-fail';

/**
 * Flow checkpoints that hit an open known bug. In strict mode (default) they are
 * asserted with expect.soft; under KNOWN_BUGS=expect-fail they are skipped (the
 * dedicated @bug test already tracks the defect) and recorded as an annotation.
 */
export async function bugCheckpoint(bug: KnownBug, check: () => Promise<unknown>): Promise<void> {
  if (expectBugsToFail) {
    test.info().annotations.push({ type: 'skipped-checkpoint', description: `${bug.id}: ${bug.summary}` });
    return;
  }
  await check();
}
