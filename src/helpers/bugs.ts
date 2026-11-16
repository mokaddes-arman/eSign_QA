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
    summary: 'React hydration error #418 (server/client text mismatch) on Activity logs and the Trash folder',
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
  BUG18: {
    id: 'BUG-18',
    severity: 'S3',
    summary: 'Webhook "Add endpoint" enables Create for a value that is not a URL ("not a url")',
    expected: 'Create endpoint stays disabled until a valid https URL is entered',
    caseId: 'DEV-014',
  },
} as const satisfies Record<string, KnownBug>;

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
