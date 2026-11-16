# eSignPro — Test Plan

| Field | Value |
|-------|-------|
| Product | eSignPro (`https://esignpro.net`) |
| Workspace under test | Global Softel — Free plan (account in `.env` → `ESIGN_EMAIL`) |
| Document version | 1.2 |
| Author | QA — Mokaddes SQA |
| Date | 13 Nov 2026 · revised 16 Nov 2026 after the manual bug session (§4.3, §16.1) |
| Suite | Playwright + TypeScript, POM, GitHub Actions |
| Status | Ready for execution with open items — see §16 |

---

## 1. Introduction

This plan describes the verification strategy for the eSignPro e-signature platform.
It covers every module discovered during the live walkthrough (see
[`FEATURES.md`](./FEATURES.md)): public/auth flows, dashboard, documents, the envelope
preparation builder, workflow/routing, signer experience, contacts, reports, developer
platform, support, account settings and billing.

The suite is built as a Page-Object-Model project (`src/pages`, `src/components`,
`src/helpers`, `src/fixtures`) with module-wise specs under `tests/`. Authentication is
solved with a persisted `storageState` file, so normal runs are fast and do not need the
e-mail OTP.

## 2. Objectives

1. Verify that every advertised module is reachable, renders correctly and enforces its
   primary rules.
2. Validate the golden path *create envelope → prepare → route → send → sign* end-to-end
   wherever the environment permits, and the builder/workflow stages in isolation where
   sending is blocked by quota or recipient mailboxes.
3. Protect the workspace with negative, boundary and permission checks (validation,
   empty states, invalid input, unauthenticated access).
4. Provide a repeatable, CI-ready regression suite with traceable test cases.
5. Leave behind durable automation assets: page objects, helpers, credentials, seeded
   session, documentation and a GitHub Actions pipeline.

## 3. Scope

### 3.1 In scope

| # | Module | Routes |
|---|--------|--------|
| 1 | Public site & authentication | `/`, `/pricing`, `/trust`, `/verify`, `/security`, `/legal`, `/changelog`, `/login`, `/login/forgot`, `/register`, `/login/verify` |
| 2 | Application shell, navigation, global search, theming | global |
| 3 | Overview dashboard | `/overview` |
| 4 | Documents library (folders, views, filters, sorting, upload, folders) | `/documents`, `/documents?folder=*` |
| 5 | Envelope preparation builder | `/documents/prepare`, `/documents/{id}/prepare` |
| 6 | Signing workflow, reminders, branding, delivery simulation | `/documents/{id}/workflow` |
| 7 | Signer experience preview | `/documents/{id}/signer-view` |
| 8 | Contacts address book and contact detail | `/contacts`, `/contacts/{id}` |
| 9 | Reports & analytics | `/reports` |
| 10 | Developer platform (API keys, endpoints, webhooks, console, guides, logs, partner) | `/developer/*` |
| 11 | Support tickets | `/support` |
| 12 | Account: profile, appearance, signatures, security, notifications, integrations, organisation, audit, payments, branding | `/account/*`, `/notifications` |
| 13 | Billing & plan, change plan, seats, payment method | `/account/billing` |
| 14 | Non-functional: responsive, accessibility, deep links, 404, session, cross-browser | global |

### 3.2 Out of scope (this cycle)

- Real money movement and Stripe settlement (no card is charged; dialogs only).
- Delivering live e-mails to external recipients and the recipient's inbox deliverability.
- Enterprise SSO/SAML identity-provider setup (requires tenant IdP).
- Partner/reseller provisioning end-to-end (requires partner credentials).
- Load/performance testing beyond smoke-level responsiveness; penetration testing.
- Legal review of terms, disclosures or e-signature compliance.

### 3.3 Assumptions

- The `esignpro.net` deployment is stable during execution. **It is the live
  deployment, not a staging copy**: every write the suite performs (folders, contacts,
  drafts, fields) lands in the real test workspace.
- The test account remains on the Free plan (6 signature requests/month) unless a trial
  is explicitly activated.
- Mailbox access for OTP is available manually, or `GMAIL_USER` + `GMAIL_APP_PASSWORD`
  (Google App Password) are configured for automated OTP retrieval.
- No CAPTCHA is presented on the auth endpoints for this deployment.

## 4. Test approach

| Layer | Technique | Tooling |
|-------|-----------|---------|
| Functional UI | Equivalence partitioning, decision tables, state transition (document lifecycle) | Playwright + POM |
| Negative / validation | Boundary values, required-field, malformed e-mail, weak password, empty submit | Playwright |
| End-to-end golden path | Scenario-based, sequential | Playwright (gated by quota/mailbox) |
| API surface | Contract/negative smoke via the in-app API console and docs | Manual + API console |
| Accessibility | Landmarks/roles, keyboard-only placement, skip link, accessible names, chart table | Playwright role-based locators + manual audit |
| Responsive | Desktop (1440×900), tablet, Pixel 7 emulation | Playwright projects |
| Cross-browser | Chromium, Firefox, WebKit | Playwright projects |
| Security (light) | Auth redirects, session artefact, no secret leakage in UI, device control | Manual + Playwright |
| Regression | Tagged `@smoke` (fast, every push) and `@regression` (full, nightly/manual) | Playwright grep |
| **Module UI** | One spec per module (`tests/ui/<module>.ui.spec.ts`): baseline a11y/layout/raw-value/JS-error checks, 390 px, dark scheme, error-colour and contrast assertions | Playwright + `src/helpers/ui.ts` |
| **User flows** | Cross-screen journeys from [`USER_FLOWS.md`](./USER_FLOWS.md) (`tests/flows/*.flow.spec.ts`), one `test.step` per step, soft checkpoints | Playwright |
| **Known bugs** | One reproduction per reported defect (`tests/bugs`, `@bug`), asserting the correct behaviour; tracked on the dashboard | Playwright + `src/helpers/bugs.ts` |
| Exploratory | Charter-based sessions on new/odd states (quota reached, empty workspace, dark documents, many recipients) | Manual |

### 4.1 Prioritisation

- **P0** — blocks login, envelope creation, signing or payment; security exposure.
- **P1** — core module function, data integrity, workflow routing.
- **P2** — secondary features, reporting, settings, developer tools.
- **P3** — cosmetic, copy, low-frequency edge cases.

### 4.2 Test types by module

| Module | Functional | Negative | E2E | A11y | Responsive | API |
|--------|:---------:|:--------:|:---:|:----:|:----------:|:---:|
| Auth | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| Overview | ✔ | – | – | ✔ | ✔ | – |
| Documents | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| Prepare | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| Workflow | ✔ | ✔ | ◐ | ✔ | ✔ | – |
| Signer | ✔ | ✔ | ◐ | ✔ | ✔ | – |
| Contacts | ✔ | ✔ | – | ✔ | ✔ | ◐ |
| Reports | ✔ | ✔ | – | ✔ | ✔ | – |
| Developer | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| Support | ✔ | ✔ | – | ✔ | ✔ | – |
| Account/Security | ✔ | ✔ | – | ✔ | ✔ | – |
| Billing | ✔ | ✔ | – | ✔ | ✔ | – |

◐ = planned/manual because it requires a real recipient mailbox or consumes the monthly quota.

### 4.3 Lessons from the 16 Nov 2026 manual session

Nine defects (BUG-01…BUG-09) were found by hand that the suite should have caught.
A tenth (BUG-10) was found while automating them. Root causes and countermeasures:

| Root cause | Example | Countermeasure (now in place) |
|------------|---------|-------------------------------|
| Specs asserted that a control **exists**, not what **happens** when it is used | Favourite toggle present; Placeholder input present | Flows use the control, then check the outcome where a user would look (`tests/flows`, `USER_FLOWS.md` checkpoints) |
| No **visual / semantic** assertions | Wrong error colour, raw validator text, unreadable field text | `expectErrorStyled`, `expectTextReadableOn` (WCAG contrast), wording checks; error-colour checks in every UI spec |
| Known defects were **written into expectations** | O9 "nothing happens" asserted as pass; O8 regex loosened | Rule: a spec never encodes a known defect as expected. Defects become `@bug` tests that assert the correct behaviour (BUG-11…14) |
| No **cross-screen** journeys | Switching documents, preview for all recipients, unique names | 50 user flows catalogued; the builder flows are automated |
| **Single-state** test data | One draft, one recipient, light theme, white page | Bug/UI checks cover dark page colour, dark scheme, duplicate names and 390 px. Second-recipient data is planned (§6) |
| **Happy-path-only** negative testing | Only the empty form was submitted | Boundary inputs (255+ chars, duplicates, empty recipient) added to builder and template cases |

**Definition of done for a feature (new):** flow row in `USER_FLOWS.md` with checkpoints,
module UI check updated, negative/boundary cases in `TEST_CASES.md`, no `@bug` test
asserting the broken behaviour.

## 5. Environments & access

| Item | Value |
|------|-------|
| Base URL | `https://esignpro.net` |
| Browser matrix | Chromium (primary), Firefox, WebKit, Pixel 7 |
| Runtime | Node.js ≥ 20 (CI: Node 22), Playwright 1.65 |
| Auth state | `auth/storageState.json` (cookies: `sf_session`, `esp_device`, `m`, Stripe IDs) |
| Credentials | `.env` (git-ignored); template in `.env.example` |
| OTP | `OTP_CODE`, Gmail IMAP (`imap.gmail.com:993` + app password), or interactive prompt |
| Artifacts | `dashboard-report/index.html` (test-health dashboard, opens in a new tab after a local run), `playwright-report/` (HTML), `test-results/` (JUnit, traces, video, screenshots) |
| CI | GitHub Actions — `.github/workflows/playwright.yml` |

### 5.1 Auth-state bootstrap

```bash
npm install
npx playwright install chromium
npm run auth:save      # headed login; enter the e-mailed OTP once
npm test               # headless runs reuse auth/storageState.json
```

`auth/storageState.json` is intentionally git-ignored. CI restores it from the
`AUTH_STORAGE_STATE_B64` secret (base64 of the same file).

`npm run auth:refresh` (also the first CI step) re-signs in headlessly when the ~12 h
`sf_session` cookie has expired. The ~90-day trusted-device cookie `esp_device` skips the
e-mail OTP, so the secret only needs regenerating when that device cookie expires
(exit code 2 → run `npm run auth:save`).

## 6. Test data

| Data | Source | Notes |
|------|--------|-------|
| Workspace owner | `.env` → `ESIGN_NAME`, `ESIGN_COMPANY`, `ESIGN_EMAIL`, `ESIGN_PASSWORD` | Created during this engagement. |
| Company type/size | `.env` → `ESIGN_COMPANY_TYPE=Other`, `ESIGN_COMPANY_SIZE=1–50` | Select values are machine-normalised in `RegisterPage`. |
| Sample agreement | `tests/fixtures/sample-agreement.png` | 850×1100 image with signature lines; used for upload/prepare. |
| Draft envelopes | Created once during exploration | Builder tests reuse the newest draft via "Continue your most recent draft". |
| Contacts | Generated per run (`QA Contact <timestamp>`) | Opens the new contact's detail page after save. |
| Folders | Generated per run (`QA Folder <timestamp>`) | Cleanup is manual (Trash/Archive). |
| Support tickets | Created only in manual negative runs | Empty-submit validation is automated. |
| Templates | One fixed test template name, `QA Template (uniqueness check)` | BUG-07 reuses it so runs never pile up templates; while BUG-10 (delete no-op) is open, two copies remain in Templates. |
| Second recipient | **Planned** — a draft with ≥ 2 recipients and their own fields | Needed for real per-recipient preview and routing checks (BUG-03, WF-002). Create it once when the quota resets. |
| API keys | Not created automatically | **Create key creates a key instantly (no confirm)** — specs must never click it. Secret is shown once; avoid leaking into logs. Two TEST keys created during the 13 Nov exploration were revoked the same day (they still list as "revoked" with a Restore option). |

**Quota caution.** The Free plan allows 6 signature requests per month and drafts consume
it. Upload tests are therefore gated:
`RUN_UPLOAD=true npx playwright test --grep @quota`.
On a fresh workspace they run as part of the golden path.

**Cleanup.** Data created by tests (folders, contacts, drafts) can be removed from the UI:
folder/row actions → Trash; contacts → contact detail → delete; drafts → row actions →
delete. Trash is emptied from `/documents?folder=trash`. The suite is idempotent for
read-only checks but intentionally leaves the last created draft for builder reuse.

## 7. Entry & exit criteria

### Entry
- Build deployed and reachable; `/login` renders.
- Test account verified; `auth/storageState.json` present and not expired.
- `.env` populated; Chromium installed.
- Test data seeded (at least one draft envelope for builder tests).

### Exit
- 100 % of P0 automated cases executed and passing.
- ≥ 95 % of P1 cases executed; no open P0/P1 defects.
- All P2 failures triaged with severity/priority and documented.
- HTML report + JUnit published; feature/test documentation updated.
- No secret (password, API key, OTP, storage state) committed to git.

### Suspension / resumption
Suspend if the site is down, auth is broken for > 30 min, or the quota is exhausted
mid-run. Resume after a fresh session is saved and data is cleaned; re-run `@smoke` first.

## 8. Module-wise execution plan

| Phase | Modules | Cases | Automation spec | Entry → Exit |
|-------|---------|-------|-----------------|--------------|
| P1 — Smoke | Public pages & access control, Auth, Navigation, Overview, Documents list, Prepare landing, Signer preview, Reports, Support, Account, Billing | ~30 (`@smoke`) | `tests/public`, `tests/auth`, `tests/navigation`, `tests/overview`, `tests/documents`, `tests/signer`, `tests/reports`, `tests/support`, `tests/account`, `tests/billing` | Every push / PR |
| P2 — Core | Library actions, filters/folders, Prepare builder + inspector, Workflow options, Contacts, Report sections, Developer tools, Account settings pages, Billing dialogs | ~70 | `tests/documents/*.spec.ts`, `tests/contacts`, `tests/developer`, `tests/reports`, `tests/account/settings.spec.ts` | Nightly / pre-release |
| P3 — Extended | Live signup, upload/golden path, sending & signing, row-action behaviour, persistence of settings, payments | ~70 manual + gated | Gated specs (`RUN_SIGNUP`, `RUN_UPLOAD`, `RUN_PAYMENT`) + manual charters | Weekly / release candidate |
| P4 — Non-functional | Accessibility, responsive, cross-browser, session/deep links, 404 | ~10 | All projects + manual audit | Release candidate |
| P5 — Module UI | Every module: baseline, 390 px, dark scheme, module UI states | ≈ 180 checks | `tests/ui/*.ui.spec.ts` | Nightly / pre-release |
| P6 — User flows | Builder, library, contacts, reports, account, billing, guest journeys | 8 journeys (50 catalogued) | `tests/flows/*.flow.spec.ts` | Nightly / pre-release |
| P7 — Known bugs | BUG-01…BUG-14 reproductions | 14 | `tests/bugs`, `@bug` in `tests/ui` | Every full run (CI: `KNOWN_BUGS=expect-fail`) |

## 9. Schedule (indicative)

| Day | Activity | Output |
|-----|----------|--------|
| D1 | Environment setup, MCP wiring, signup, session capture, feature inventory | `FEATURES.md`, `storageState.json` |
| D2 | POM scaffold, helpers, module specs, first green run | Test suite (now 85 automated + 33 partly automated cases) |
| D3 | Test design, negative cases, hardening, CI pipeline | `TEST_CASES.md`, workflow YAML |
| D4 | P3 manual charters (signer, API console, settings), defect triage | Defect log, evidence |
| D5 | Regression, report, sign-off | HTML/JUnit report, summary |

## 10. Roles & responsibilities

| Role | Responsibility |
|------|----------------|
| QA Engineer (Mokaddes SQA) | Plan, design, automate, execute, report, maintain suite |
| Developer | Fix defects, provide selectors/ids for unstable UI, review POM changes |
| Product Owner | Prioritise defects, accept feature behaviour, sign off |
| DevOps | Maintain CI secrets, storage-state refresh, artifact retention |

## 11. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|:----------:|:------:|------------|
| R1 | E-mail OTP blocks login/signup automation | High | High | Persist `storageState`; support `OTP_CODE`, Gmail IMAP and interactive prompt |
| R2 | Free-plan quota (6/month) exhausted | High | Medium | Builder tests reuse a draft; upload tests gated by `RUN_UPLOAD`; cleanup/plan reset |
| R3 | Client-side hydration swallows early clicks | Medium | Medium | `BasePage.settle()` waits for network idle; role-based locators with retries |
| R4 | Copy/selector drift through rapid releases | High | Medium | Role/name locators first, scoped locators, one place per page object |
| R5 | Test data pollution (folders, contacts, drafts) | High | Low | Unique names, documented cleanup, read-only assertions where possible |
| R6 | Stripe/payment UI changes or real charges | Low | High | Dialog-only assertions; never confirm a paid plan without approval |
| R7 | API keys/secret leakage in logs or reports | Low | High | No automated key creation; redact secrets; artifacts private |
| R8 | Parallel workers sharing one account state | Medium | Low | Workers ≤ 2 on CI; avoid mutating shared settings |
| R9 | Cross-browser timing differences | Medium | Low | Dedicated projects; Chromium gates smoke, others nightly |
| R10 | Session expiry mid-run | **High** | **High** | `sf_session` lives ~12 h, so the `AUTH_STORAGE_STATE_B64` secret is stale before the next nightly run. Configure `GMAIL_USER` + `GMAIL_APP_PASSWORD` so CI can log in with OTP, or refresh the secret before each run |
| R11 | Backend timeouts under parallel load | Medium | Medium | Pages show "Can't reach the eSignPro API"; `BasePage.goto()` reloads once, failures beyond that are logged as defects (FEATURES O1) |
| R12 | Monthly quota already exhausted (6/6 until 13 Dec 2026) | High | High | Upload, send and golden-path cases are blocked; reset quota, start an Enterprise trial, or use a fresh workspace |
| R13 | Live-site writes from automation | High | Low | 21+ folders and 8+ contacts accumulated. Every write test is tagged `@data` and **CI excludes `@data`** (`--grep-invert @data`); run them locally |
| R14 | **Public repository** exposes test-run artifacts | High | High | Reports, videos and traces show the signed-in workspace, and traces include request cookies. Artifact retention cut to 7 days. **Decision needed:** make the repo private, or disable trace/video on CI |
| R15 | Shared-draft mutation by builder/flow/bug tests | Medium | Medium | Every change is reverted in `finally` (placeholder, favourites, name, placed field). All draft specs run in the `chromium-builder` project with `workers: 1`, so they never race each other (seen on 16 Nov: a 2-worker run let a flow delete a field another spec was clicking) |
| R16 | Template clean-up impossible while BUG-10 is open | High | Low | Fixed template name caps pollution at 2 templates; delete them once BUG-10 is fixed |
| R17 | **Single active session per account** (FEATURES O12) | High | High | Any sign-in during a run (UF-05, `auth:save`, a teammate, a second CI job) signs out the shared session and every later test lands on `/login?reason=superseded`. `BasePage.goto()` now fails fast with a clear message. UF-05 is opt-in (`RUN_LOGIN_FLOW=true`, run alone). CI keeps `concurrency` per ref; never run two suites against the account at once. A dedicated CI account would remove the risk |
| R18 | Debounced autosave (FEATURES O13) | Medium | Low | Flows wait for network idle before reloading or leaving the builder |

## 12. Defect management

| Severity | Definition | Example |
|----------|------------|---------|
| S1 Blocker | Cannot log in, create, send or sign; data loss; security exposure | OTP never arrives; document deleted on save |
| S2 Critical | Core flow broken with a workaround | Filter returns wrong set; field placement fails |
| S3 Major | Feature partially broken or misleading | Reminder option not persisted |
| S4 Minor | Cosmetic, copy, low-frequency edge | Alignment, typo, tooltip |

Priority: P0 (fix immediately) → P3 (backlog). Every failure captured with Playwright
trace, video and screenshot; bug report links the test case ID and artifact path.

## 13. Metrics & reporting

- Execution: passed / failed / skipped / flaky per module and tag.
- Coverage: automated vs manual cases per module (see `TEST_CASES.md` "A/M" column).
- Defects: count by severity, age, module; escape rate.
- Quality gates: smoke green on PR, full green nightly, zero P0/P1 open before release.
- Reports: Playwright HTML + JUnit uploaded from CI; summary posted on the PR.
- **Test-health dashboard** (`reporters/dashboard-reporter.ts`): one self-contained HTML file
  written to `dashboard-report/index.html` after every run and opened in a new browser tab
  locally (`DASHBOARD_OPEN=never|always` overrides). Tabs: Overview (pass-rate ring,
  20-run trend, stats, known bugs open), Tests (search), Failures (clustered errors with
  screenshot/video/trace links), **Known bugs** (BUG id, state, severity, expected vs
  actual), **Modules** (per-module health by layer: functional / UI / flow / bug),
  Breakdown, Slowest, Timeline. Secrets in error text are redacted. CI uploads it as the
  `test-dashboard-chromium` artifact and writes the totals to the job summary.

## 14. CI/CD integration

The GitHub Actions workflow:

1. Triggers on push/PR to `main`, nightly at 02:00 UTC and on demand.
2. Installs Node 22, `npm ci`, Chromium with dependencies.
3. Restores `auth/storageState.json` from `AUTH_STORAGE_STATE_B64`, then refreshes it
   headlessly (`scripts/refresh-auth.ts`, trusted device; no OTP).
4. Runs smoke (`@smoke`, excluding `@data`/`@bug`) on PRs and the full suite on
   `main`/nightly, excluding `@data`. Known-bug tests run with `KNOWN_BUGS=expect-fail`.
5. Uploads `test-dashboard`, `playwright-report` and `test-results` artifacts (7-day retention, R14).
6. Writes pass/fail/flaky/skipped, pass rate and known bugs reproduced to the job summary.
7. Fails the job on any unexpected result: a new failure, **or a known bug that no longer
   reproduces** (time to promote its test).

Jobs that sign in never overlap (single active session, R17): the Firefox/WebKit smoke
job runs after Chromium with `max-parallel: 1`.

Manual gates: OTP refresh when the session expires, quota reset, and any approval before
switching to a paid plan or sending real envelopes to third parties.

## 15. Deliverables

- `docs/FEATURES.md` — module-wise feature inventory.
- `docs/TEST_PLAN.md` — this plan.
- `docs/TEST_CASES.md` — module-wise manual/automated test cases.
- `tests/**` — Playwright specs mapped to case IDs.
- `src/pages/**`, `src/components/**`, `src/helpers/**`, `src/fixtures/**` — POM framework.
- `.env` / `.env.example` — credentials and configuration (`.env` git-ignored).
- `auth/storageState.json` — reusable signed-in session (git-ignored).
- `.github/workflows/playwright.yml` — CI pipeline.
- `docs/USER_FLOWS.md` — catalogue of every user flow with checkpoints and automation status.
- `tests/ui/*.ui.spec.ts` — one UI spec per module; `tests/flows/*.flow.spec.ts` — journeys;
  `tests/bugs/*` — defect reproductions; `src/helpers/{ui,bugs,uiSuite}.ts`.
- `reporters/` — test-health dashboard reporter (`dashboard-report/index.html`).
- `scripts/refresh-auth.ts` — OTP-free session refresh (`npm run auth:refresh`).
- Playwright HTML/JUnit reports per run.

## 16. Readiness review — 13 Nov 2026

| Area | Status | Notes |
|------|:------:|-------|
| Feature inventory | ✅ | `FEATURES.md` re-verified against 49 authenticated routes + guest pages; 11 observations logged (§14 there). |
| Test design | ✅ | 190 cases; every feature ID traced to a case (`TEST_CASES.md` traceability table). |
| Automation | ✅ | 85 fully + 33 partly automated cases; `tsc` clean. Full Chromium suite ×3 after fixes: 284 passed, 1 failed (form-catalog timing, since fixed), 18 skipped (gated `@quota`/`@payment`/`RUN_SIGNUP`). |
| Flakiness | ✅ fixed / ⚠️ re-verify | Root causes removed: data-dependent API-key empty-state assertion, brittle `getByText('Free')` plan locator + backend timeout, duplicate billing test, builder tests racing on one draft (now serial), form catalog clicked before the client-routed view rendered, and the field-placement test leaving a new Signature field on the shared draft every run (now undone; 5 leftover fields remain on the draft). The last two builder fixes could not be re-run: the backend was returning "Can't reach the eSignPro API" at the end of the session. |
| Repository hygiene | ✅ fixed | `.gitignore` rule `auth/` also ignored `tests/auth/`, so login/signup specs were never committed; now `/auth/`. |
| Auth for CI | ⚠️ open | Session lasts ~12 h; nightly CI needs IMAP OTP or a fresh `AUTH_STORAGE_STATE_B64` (R10). |
| Test data / quota | ⚠️ open | Quota 6/6 used; upload, send and signing cases blocked until 13 Dec (R12). Clean up `QA Folder …` / `QA Contact …` items. (The two TEST API keys created during exploration are revoked.) |
| Payment config | ⚠️ open | `.env` `CARD_NUMBER` has 18 digits; the Stripe test card is `4242 4242 4242 4242` (16). The `@payment` plan-switch test swallows errors with `.catch()` and asserts only that "Team" text exists — rewrite before relying on it. |
| Cross-browser | ⚠️ partial | Firefox skips two `/documents` select tests (renderer crash); WebKit/mobile run smoke only. |

**Verdict:** the plan is ready for P1/P2 execution (smoke + core). P3 (golden path, sending,
signing, payments) is blocked until the quota is reset and CI authentication is solved.

### 16.1 Update — 16 Nov 2026

| Area | Status | Notes |
|------|:------:|-------|
| Manual findings | ✅ automated | BUG-01…BUG-09 each have a reproduction; all 9 reproduce on Chromium. BUG-10 (template Delete/Archive no-op) found while automating. Observations O6–O9 promoted to BUG-11…14 |
| New findings from the UI layer | ✅ tracked | BUG-15 (form error grey), BUG-16 (intermittent React hydration error, recorded as annotation), BUG-17 (blank contact name silently ignored), BUG-18 (webhook URL validation). Constraints: single active session (R17), debounced autosave (R18) |
| Test design | ✅ | `TEST_CASES.md`: 204 cases (14 new, stray rows fixed). `USER_FLOWS.md`: 50 flows |
| UI layer | ✅ | 14 module UI specs (≈ 180 checks) |
| Reporting | ✅ | Dashboard reporter with Known bugs and Modules tabs; opens after local runs; CI artifact + job summary |
| Auth for CI | ✅ improved | `auth:refresh` re-signs in without OTP using the trusted-device cookie (R10) |
| Repository hygiene | ⚠️ action needed | The test-account password appeared in `TEST_CASES.md` (AUTH-005) and the account e-mail in four tracked files of this **public** repo. Removed from the working tree; still in git history. **Rotate the password**; optionally purge history. `.gitignore` extended (`.env.*`, `dashboard-report/`, scratch files) |
| Payment config | ⚠️ open | `.env` `CARD_NUMBER` is 18 digits; `.env.example` now documents the 16-digit Stripe test card |
