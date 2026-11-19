# eSignPro — QA Coverage, Execution & Quality Summary

| | |
|---|---|
| Application | https://esignpro.net — **live production deployment** (test workspace "Global Softel") |
| Report generated | **19 Nov 2026 16:10 UTC** (regenerated automatically after every test run) |
| Latest test run | **19 Nov 2026 16:09 UTC** |
| Suite | Playwright 1.65 + TypeScript, Page Object Model with self-healing locators |
| Browsers | Chromium (primary, full suite), Firefox, WebKit, Pixel 7 emulation (smoke) |
| Deliverables | `QA_Coverage_Matrix.xlsx` · `QA_Gap_Analysis.xlsx` · `QA_Execution_Summary.xlsx` · `QA_Bug_Report.xlsx` |
| Evidence | `reports-archive/<run>/` — HTML report, JUnit, dashboard, traces, screenshots, videos per run |

> This file is generated from `qa-reports/summary_template.md`. Numbers, dates and tables come
> from archived run results only (`generate_reports.py`); edit the template, not this file.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| Unique testing scenarios required | **382** across the nine testing categories |
| Implemented (asserting the outcome) | **211** — 119 before this QA cycle |
| Partially implemented | **77** (presence-only or subset checks) |
| Missing (not implemented) | **94** — manual-only 22, blocked by an external dependency 45 |
| Scenarios executed | **277** — passed **219**, failed **58** |
| Skipped / Blocked / Not executed | **0** / **53** / **52** |
| Test-level result (latest Chromium state) | **429 tests: 399 passed, 30 failed, 0 skipped** |
| Failing tests by cause | 27 application defect, 3 environment |
| Defects tracked | **28** — 19 Confirmed, 9 New; severity 14 Major, 12 Minor, 2 Critical |
| **Verified coverage** | **Implementation 55.2%** · **Execution 72.5%** · **Passing 57.3%** · **Execution pass rate 79.1%** |

Definitions: implementation = implemented ÷ required; execution = (passed + failed) ÷ required;
passing = passed ÷ required; pass rate = passed ÷ executed. Denominator = unique scenarios.

## 2. Category-wise coverage

| Category | Required | Implemented (before → now) | Partial | Missing | Passed | Failed | Skipped | Blocked | Not run | Implementation | Execution | Passing | Pass rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Unit Testing | 12 | 0 → 0 | 0 | 12 | 0 | 0 | 0 | 12 | 0 | 0.0% → **0.0%** | 0.0% | 0.0% | 0.0% |
| Integration Testing | 24 | 0 → 16 | 0 | 8 | 15 | 0 | 0 | 5 | 4 | 0.0% → **66.7%** | 62.5% | 62.5% | 100.0% |
| Functional Testing | 173 | 63 → 84 | 52 | 37 | 118 | 17 | 0 | 9 | 29 | 36.4% → **48.6%** | 78.0% | 68.2% | 87.4% |
| E2E Testing | 53 | 16 → 24 | 15 | 14 | 27 | 8 | 0 | 16 | 2 | 30.2% → **45.3%** | 66.0% | 50.9% | 77.1% |
| Regression Testing | 32 | 21 → 28 | 1 | 3 | 4 | 25 | 0 | 0 | 3 | 65.6% → **87.5%** | 90.6% | 12.5% | 13.8% |
| Security Testing | 36 | 3 → 24 | 2 | 10 | 24 | 1 | 0 | 5 | 6 | 8.3% → **66.7%** | 69.4% | 66.7% | 96.0% |
| Performance Testing | 9 | 0 → 4 | 1 | 4 | 5 | 0 | 0 | 4 | 0 | 0.0% → **44.4%** | 55.6% | 55.6% | 100.0% |
| Usability & Accessibility Testing | 28 | 11 → 19 | 5 | 4 | 17 | 6 | 0 | 0 | 5 | 39.3% → **67.9%** | 82.1% | 60.7% | 73.9% |
| Compatibility Testing | 15 | 5 → 12 | 1 | 2 | 9 | 1 | 0 | 2 | 3 | 33.3% → **80.0%** | 66.7% | 60.0% | 90.0% |
| **Total** | **382** | **119 → 211** | 77 | 94 | **219** | **58** | 0 | 53 | 52 | **31.2% → 55.2%** | **72.5%** | **57.3%** | **79.1%** |

Regression: most scenarios are bug retests, which "fail" while the bug is still open — a
low pass rate there means the bugs are not fixed yet, not that the suite is unstable.

## 3. How the suite behaves

- **No skipped cases.** Opt-in gates were removed. Stateful journeys (Stripe payments, uploads,
  sign-in / sign-out) run in the serial `chromium-account` project after every other
  Chromium test, followed by an automatic `session-restore`. Data preconditions are read from
  the API and *fail* with "Precondition failed (test data): …" instead of skipping.
- **A test fails only when an expectation is not met.** Page-object locators self-heal
  (role → exact text → aria-label/title); every healing is reported as a `self-healed`
  annotation so the primary locator can be updated. Clicks that land before React hydration
  are retried until the expected UI appears.
- **Every failure says what went wrong** — a `failure-summary` annotation and attachment:
  missing element (with the closest elements on the page), expectation not met (expected vs
  got), test-data precondition, or environment (site unreachable, session superseded,
  browser crash).
- **Payments run against Stripe test mode only** (the tests assert "Stripe test mode" before
  entering card data). Upgrades are charged immediately; downgrades are scheduled for renewal,
  so BIL-007 is a state machine that charges at most once per billing period.
- **Uploads are quota-aware**: with requests left they upload, verify the new draft and move it
  to Trash; with none left they assert the refusal and upgrade guidance (DOC-022).

## 4. Defects

| Bug | Severity | QA status | Module | Summary |
|---|---|---|---|---|
| BUG-07 | Critical | Confirmed | Templates | Template names are not unique (Save and Rename both accept an existing name). |
| BUG-10 | Critical | Confirmed | Templates | Delete (and Archive) on a template does nothing — no request, no confirmation, template stays. |
| BUG-01 | Major | Confirmed | Prepare | Field label/placeholder text is unreadable when the document page has a black background. |
| BUG-03 | Major | Confirmed | Signer | Preview cannot show how all recipients will see the document. |
| BUG-04 | Major | Confirmed | Prepare | Opening another document while one is open in the builder shows no warning. |
| BUG-05 | Major | Confirmed | Prepare | Placeholder text set in the inspector is not shown on the editing canvas. |
| BUG-06 | Major | Confirmed | Prepare | Document-name character-limit error has raw validator wording and is not shown in the error colour. |
| BUG-08 | Major | Confirmed | Workflow | Missing recipient e-mail is shown as an amber advisory instead of a blocking error. |
| BUG-11 | Major | Confirmed | Support | Submitting an empty support ticket gives no validation feedback. |
| BUG-17 | Major | Confirmed | Contacts | Saving a new contact without a name does nothing — no message, field not flagged. |
| BUG-18 | Major | Confirmed | Developer | Webhook 'Create endpoint' is enabled for a value that is not a URL. |
| BUG-20 | Major | New | Platform | Reflow (WCAG 1.4.10): the sign-in page and the signed-in app shell are 360 px wide, so a 320 px viewport (400 % zoom on 1280 px) scrolls hor |
| BUG-23 | Major | New | Documents | Documents status filter 'Drafts' returns 0 documents while the 'Drafts' view lists all 6 prepared drafts. |
| BUG-24 | Major | Confirmed | Platform | Slow first visit: immutable static JS chunks are served from the origin (nginx, no CDN) with ~1.0–1.8 s time-to-first-byte each; cold page l |
| BUG-25 | Major | New | Billing | Upgrading Free to Team invoiced the full month ($12.00) although the change-plan preview promised 'Prorated today $9.99'; the billing anchor |
| BUG-28 | Major | New | Reports | WebKit (Safari engine): once the report period has been changed, the Reports page ignores further period changes and every section-tab click |
| BUG-02 | Minor | Confirmed | Prepare | Favouriting a field does not move it to the top of the field palette. |
| BUG-09 | Minor | Confirmed | Workflow | Recipients can be edited inline in the Workflow step as well as in Manage recipients. |
| BUG-12 | Minor | Confirmed | Account | Organization section heading reads 'People1' (count glued to the label). |
| BUG-13 | Minor | Confirmed | Public | Trust-centre hero accessible name reads 'eSignProhandles' (missing space). |
| BUG-14 | Minor | Confirmed | Billing | Change-plan dialog pre-selects Enterprise for a Free workspace. |
| BUG-15 | Minor | Confirmed | Auth | Registration validation error is shown in neutral grey, not the error colour. |
| BUG-16 | Minor | Confirmed | Platform | Intermittent React hydration error #418 (server/client text mismatch) on Activity logs / Trash. |
| BUG-19 | Minor | New | Platform | Label in Name (WCAG 2.5.3): accessible names omit visible text on the logo link ('eSignPro home'), the global-search button (visible 'Ctrl K |
| BUG-21 | Minor | New | Auth | Password meter labels passwords that break the stated rule ('Use 12+ characters with a number, capital and symbol') as 'Strong'. |
| BUG-22 | Minor | New | Transport | Server software and version disclosed in HTTP response headers. |
| BUG-26 | Minor | New | Billing | Change-plan dialog says 'Applies immediately with proration' for every choice, but a downgrade is only scheduled for the end of the period. |
| BUG-27 | Minor | New | Billing | 'Recent charges' says 'No charges yet - the first invoice has not been collected' while the invoice list shows a Paid $12.00 invoice. |

Steps to reproduce, expected/actual results and screenshot/trace paths: `QA_Bug_Report.xlsx`.

## 5. Major risks

1. **The signing golden path is still unverified end-to-end** — send → sign → certificate,
   decline, reassign need a controlled recipient mailbox (no IMAP credentials in `.env`).
2. **Billing accuracy** — the change-plan preview promises a prorated charge, but the upgrade
   invoiced the full month (BUG-25); the dialog says changes apply immediately while
   downgrades are scheduled (BUG-26); "Recent charges" ignores a paid invoice (BUG-27).
3. **Template management** — Delete/Archive do nothing and names are not unique (BUG-07/10).
4. **Slow first visit** — static assets ~1–1.8 s each from the origin; cold loads 6–15 s (BUG-24).
5. **Safari/WebKit: Reports page stops navigating after the period changes** (BUG-28) — further
   period changes and every section tab are ignored; Chromium and Firefox work.
6. **Testing on production with one account** — one active session per account: on 19 Nov the
   suite was signed out mid-run when the account signed in elsewhere. Every write (cards, plan
   changes, signup workspaces, drafts moved to Trash) lands in the live workspace.
7. **Stripe anti-bot challenge** — after repeated automated card additions Stripe now shows an
   hCaptcha challenge in Checkout, so BIL-004 (add a card) fails as an environment issue. Fix on
   the Stripe side: use a Stripe test-mode account/settings without the challenge for QA, or
   run BIL-004 less often (each run adds a card; the UI has no "remove card").

## 6. Remaining work

- **Blocked:** unit tests (no application source), load/stress/soak and penetration tests (need
  staging + authorization), role-based access (one seat), real devices, OTP e-mail flows
  (need `GMAIL_USER` + `GMAIL_APP_PASSWORD`).
- **Manual:** screen-reader passes, UX heuristic review, 2FA/passkeys, password change.
- **Automatable next:** strengthen the remaining presence-only tests to assert outcomes; write
  tests for archive/trash lifecycle, contact edit, report export on staging.
- **Environment to fix:** a dedicated QA account (or staging) so nobody else's sign-in ends the
  suite's session; Stripe test settings without hCaptcha; a CDN for static assets (BUG-24).
- **Known environment noise:** Playwright's Firefox build crashes the tab on two `/documents`
  select tests (not reproducible in a standalone session) — reported as environment, not a defect.

Gap list with priorities and recommended actions: `QA_Gap_Analysis.xlsx`.

## 7. Execution log

| Run | Date | Projects | Tests | Passed | Failed | Skipped | Evidence |
|---|---|---|---|---|---|---|---|
| 16 Nov 2026 full run (previous cycle) | 16 Nov 2026 16:25 UTC | chromium, chromium-builder | 295 | 272 | 17 | 6 | `reports-archive/2026-11-16T16-25-29-359Z_pre-baseline` |
| Baseline — existing suite, 17 Nov | 17 Nov 2026 15:04 UTC | chromium, chromium-builder | 295 | 250 | 38 | 7 | `reports-archive/2026-11-17T15-04-14-034Z_baseline` |
| Re-run of baseline failures (2 workers) | 17 Nov 2026 15:19 UTC | chromium, chromium-builder | 38 | 16 | 22 | 0 | `reports-archive/2026-11-17T15-19-04-106Z_rerun-failed` |
| New tests — first execution | 17 Nov 2026 15:39 UTC | chromium | 114 | 88 | 25 | 1 | `reports-archive/2026-11-17T15-39-06-841Z_new-tests-run1` |
| Performance (alone, 1 worker) | 17 Nov 2026 16:08 UTC | chromium | 11 | 5 | 6 | 0 | `reports-archive/2026-11-17T16-08-59-357Z_perf` |
| Cross-browser smoke (Firefox, WebKit, Pixel 7) | 17 Nov 2026 16:46 UTC | firefox, mobile-chrome, webkit | 126 | 112 | 3 | 11 | `reports-archive/2026-11-17T16-46-24-914Z_xbrowser` |
| Final regression — existing + new tests | 17 Nov 2026 17:24 UTC | chromium, chromium-builder | 412 | 375 | 30 | 7 | `reports-archive/2026-11-17T17-24-57-205Z_final-regression` |
| Retest of tests hardened after the final run (18 Nov) | 18 Nov 2026 14:35 UTC | chromium | 5 | 5 | 0 | 0 | `reports-archive/2026-11-18T14-35-18-290Z_final-retest` |
| Cross-browser retest of hardened tests (18 Nov) | 18 Nov 2026 14:36 UTC | firefox, mobile-chrome, webkit | 6 | 6 | 0 | 0 | `reports-archive/2026-11-18T14-36-29-280Z_xbrowser-retest` |
| BUG-12 retest after fixing its false-pass test (18 Nov) | 18 Nov 2026 14:40 UTC | chromium | 1 | 0 | 1 | 0 | `reports-archive/2026-11-18T14-40-00-827Z_bug12-retest` |
| Gated session tests SESS-001…003 (RUN_SIGNOUT=true, run alone) | 18 Nov 2026 14:33 UTC | chromium | 3 | 3 | 0 | 0 | `reports-archive/2026-11-18T14-33-49-475Z_signout` |
| Automatic run 2026-11-18 15-45-39 | 18 Nov 2026 15:45 UTC | firefox | 1 | 0 | 1 | 0 | `reports-archive/2026-11-18T15-45-39-836Z_auto` |
| Automatic run 2026-11-18 16-19-33 | 18 Nov 2026 16:19 UTC | chromium, chromium-builder | 408 | 373 | 35 | 0 | `reports-archive/2026-11-18T16-19-33-246Z_auto` |
| Automatic run 2026-11-18 16-28-40 | 18 Nov 2026 16:28 UTC | firefox, mobile-chrome, webkit | 120 | 112 | 7 | 1 | `reports-archive/2026-11-18T16-28-40-702Z_auto` |
| Automatic run 2026-11-18 16-34-37 | 18 Nov 2026 16:34 UTC | chromium-account | 22 | 18 | 4 | 0 | `reports-archive/2026-11-18T16-34-37-273Z_auto` |
| Automatic run 2026-11-18 17-01-48 | 18 Nov 2026 17:01 UTC | chromium, chromium-builder | 407 | 373 | 34 | 0 | `reports-archive/2026-11-18T17-01-48-603Z_auto` |
| Automatic run 2026-11-18 17-06-48 | 18 Nov 2026 17:06 UTC | chromium-account | 22 | 17 | 5 | 0 | `reports-archive/2026-11-18T17-06-48-532Z_auto` |
| Automatic run 2026-11-18 17-16-11 | 18 Nov 2026 17:16 UTC | firefox, mobile-chrome, webkit | 120 | 115 | 5 | 0 | `reports-archive/2026-11-18T17-16-11-269Z_auto` |
| Automatic run 2026-11-18 17-19-24 | 18 Nov 2026 17:19 UTC | chromium, webkit | 16 | 12 | 4 | 0 | `reports-archive/2026-11-18T17-19-24-456Z_auto` |
| Automatic run 2026-11-18 17-29-20 | 18 Nov 2026 17:29 UTC | chromium, firefox, webkit | 3 | 2 | 1 | 0 | `reports-archive/2026-11-18T17-29-20-393Z_auto` |
| Automatic run 2026-11-19 15-09-43 | 19 Nov 2026 15:09 UTC | chromium, chromium-builder | 408 | 369 | 39 | 0 | `reports-archive/2026-11-19T15-09-43-516Z_auto` |
| Automatic run 2026-11-19 15-17-07 | 19 Nov 2026 15:17 UTC | chromium-account | 22 | 12 | 10 | 0 | `reports-archive/2026-11-19T15-17-07-071Z_auto` |
| Automatic run 2026-11-19 15-30-31 | 19 Nov 2026 15:30 UTC | chromium-account | 3 | 2 | 1 | 0 | `reports-archive/2026-11-19T15-30-31-230Z_auto` |
| Automatic run 2026-11-19 15-31-37 | 19 Nov 2026 15:31 UTC | chromium-account | 3 | 3 | 0 | 0 | `reports-archive/2026-11-19T15-31-37-536Z_auto` |
| Automatic run 2026-11-19 15-48-21 | 19 Nov 2026 15:48 UTC | chromium, chromium-builder | 408 | 381 | 27 | 0 | `reports-archive/2026-11-19T15-48-21-232Z_auto` |
| Automatic run 2026-11-19 15-53-48 | 19 Nov 2026 15:53 UTC | chromium-account | 22 | 19 | 3 | 0 | `reports-archive/2026-11-19T15-53-48-972Z_auto` |
| Automatic run 2026-11-19 16-01-44 | 19 Nov 2026 16:01 UTC | firefox, mobile-chrome, webkit | 123 | 119 | 4 | 0 | `reports-archive/2026-11-19T16-01-44-201Z_auto` |
| Automatic run 2026-11-19 16-09-34 | 19 Nov 2026 16:09 UTC | chromium-account | 2 | 1 | 1 | 0 | `reports-archive/2026-11-19T16-09-34-676Z_auto` |

Reports regenerate automatically after every run (`reporters/qa-reports-reporter.ts`):
the run is archived to `reports-archive/<run date>_auto/` and these files are rebuilt.
Disable with `QA_REPORTS=off`; rebuild by hand with `npm run qa:reports`.
