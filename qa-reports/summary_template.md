# eSignPro — QA Coverage, Execution & Quality Summary

| | |
|---|---|
| Application | https://esignpro.net — **live production deployment** (test workspace "Global Softel") |
| Report generated | **{{GENERATED}}** (regenerated automatically after every test run) |
| Latest test run | **{{LATEST_RUN}}** |
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
| Unique testing scenarios required | **{{REQUIRED}}** across the nine testing categories |
| Implemented (asserting the outcome) | **{{IMPLEMENTED}}** — {{INITIAL_IMPLEMENTED}} before this QA cycle |
| Partially implemented | **{{PARTIAL}}** (presence-only or subset checks) |
| Missing (not implemented) | **{{MISSING}}** — manual-only {{MANUAL}}, blocked by an external dependency {{BLOCKED_DEP}} |
| Scenarios executed | **{{EXECUTED}}** — passed **{{PASSED}}**, failed **{{FAILED}}** |
| Skipped / Blocked / Not executed | **{{SKIPPED}}** / **{{BLOCKED}}** / **{{NOT_EXECUTED}}** |
| Test-level result (latest Chromium state) | **{{TESTS_TOTAL}} tests: {{TESTS_PASSED}} passed, {{TESTS_FAILED}} failed, {{TESTS_SKIPPED}} skipped** |
| Failing tests by cause | {{FAILURE_CAUSES}} |
| Defects tracked | **{{BUGS_TOTAL}}** — {{BUGS_BY_STATUS}}; severity {{BUGS_BY_SEVERITY}} |
| **Verified coverage** | **Implementation {{IMPL_PCT}}%** · **Execution {{EXEC_PCT}}%** · **Passing {{PASS_PCT}}%** · **Execution pass rate {{RATE_PCT}}%** |

Definitions: implementation = implemented ÷ required; execution = (passed + failed) ÷ required;
passing = passed ÷ required; pass rate = passed ÷ executed. Denominator = unique scenarios.

## 2. Category-wise coverage

{{CATEGORY_TABLE}}

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

{{BUG_TABLE}}

Steps to reproduce, expected/actual results and screenshot/trace paths: `QA_Bug_Report.xlsx`.

## 5. Major risks

1. **The signing golden path is still unverified end-to-end** — send → sign → certificate,
   decline, reassign need a controlled recipient mailbox (no IMAP credentials in `.env`).
2. **Billing accuracy** — the change-plan preview promises a prorated charge, but the upgrade
   invoiced the full month (BUG-25); the dialog says changes apply immediately while
   downgrades are scheduled (BUG-26); "Recent charges" ignores a paid invoice (BUG-27).
3. **Template management** — Delete/Archive do nothing and names are not unique (BUG-07/10).
4. **Slow first visit** — static assets ~1–1.8 s each from the origin; cold loads 6–15 s (BUG-24).
5. **Testing on production with one account** — one active session per account; every write
   (cards, plan changes, signup workspaces, drafts moved to Trash) lands in the live workspace.

## 6. Remaining work

- **Blocked:** unit tests (no application source), load/stress/soak and penetration tests (need
  staging + authorization), role-based access (one seat), real devices, OTP e-mail flows
  (need `GMAIL_USER` + `GMAIL_APP_PASSWORD`).
- **Manual:** screen-reader passes, UX heuristic review, 2FA/passkeys, password change.
- **Automatable next:** strengthen the remaining presence-only tests to assert outcomes; write
  tests for archive/trash lifecycle, contact edit, report export on staging.

Gap list with priorities and recommended actions: `QA_Gap_Analysis.xlsx`.

## 7. Execution log

{{RUN_TABLE}}

Reports regenerate automatically after every run (`reporters/qa-reports-reporter.ts`):
the run is archived to `reports-archive/<run date>_auto/` and these files are rebuilt.
Disable with `QA_REPORTS=off`; rebuild by hand with `npm run qa:reports`.
