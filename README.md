# eSignPro QA — Playwright (POM) Automation Suite

End-to-end and regression automation for **https://esignpro.net**, built with
**Playwright + TypeScript** using a **Page Object Model**. The suite covers every module
discovered during the live walkthrough: authentication, dashboard, documents, the envelope
builder, signing workflow, signer preview, contacts, reports, developer platform, support,
account/security settings and billing.

| | |
|---|---|
| Base URL | `https://esignpro.net` |
| Test workspace | **Global Softel** — Free plan |
| Owner | Mokaddes SQA (test account e-mail in `.env` → `ESIGN_EMAIL`) |
| Runtime | Node.js ≥ 20 (CI uses 22), Playwright 1.65 |
| Docs | [`docs/FEATURES.md`](docs/FEATURES.md) · [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) · [`docs/TEST_CASES.md`](docs/TEST_CASES.md) · [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) |

---

## 1. Quick start

```bash
# from the project root
npm install
npx playwright install chromium   # add firefox webkit for cross-browser projects

# .env already contains the live credentials; to start from scratch:
#   copy .env.example .env  and fill in the values

npm run typecheck                 # TypeScript gate
npm test                          # full suite, Chromium, uses the saved session
npm run test:smoke                # only @smoke-tagged cases
npm run report                    # open the last HTML report
npm run report:dashboard          # re-open the test-health dashboard
```

After every local run the **test-health dashboard** (`dashboard-report/index.html`) opens in
a new browser tab: overview, failures with screenshots/traces, **Known bugs** and
**Modules**. Set `DASHBOARD_OPEN=never` to suppress the tab, `always` to force it.

A fresh checkout without `auth/storageState.json` still runs: authenticated specs will be
redirected to `/login` and fail, so capture a session first (section 4).

## 2. Project structure

```
esignpro-qa/
├─ src/
│  ├─ pages/              # Page Objects (one per module/route)
│  │  ├─ BasePage.ts          # goto(), settle() hydration guard, shared helpers
│  │  ├─ LoginPage.ts         # /login  (submit button is "Continue")
│  │  ├─ RegisterPage.ts      # /register (company size normalisation)
│  │  ├─ VerifyEmailPage.ts   # /login/verify
│  │  ├─ OverviewPage.ts      # /overview
│  │  ├─ DocumentsPage.ts     # /documents (filters, folders, upload)
│  │  ├─ PreparePage.ts       # /documents/{id}/prepare (field palette, inspector)
│  │  ├─ WorkflowPage.ts      # /documents/{id}/workflow
│  │  ├─ SignerPreviewPage.ts # /documents/{id}/signer-view
│  │  ├─ ContactsPage.ts      # /contacts, /contacts/{id}
│  │  ├─ ReportsPage.ts       # /reports
│  │  ├─ DeveloperPage.ts     # /developer/*
│  │  ├─ SupportPage.ts       # /support
│  │  ├─ AccountProfilePage.ts# /account/profile, /account/security
│  │  └─ BillingPage.ts       # /account/billing
│  ├─ components/Navigation.ts# sidebar, account menu, global search
│  ├─ helpers/                # authFlow (login/signup/OTP), otp (IMAP), wait, logger,
│  │                          # ui (contrast, error colour, a11y), uiSuite (UI baseline), bugs (known-bug registry)
│  ├─ fixtures/test.ts        # every page object + logStep as a test fixture
│  └─ config/env.ts           # typed .env access
├─ tests/
│  ├─ auth/          login.spec.ts · signup.spec.ts
│  ├─ navigation/    navigation.spec.ts
│  ├─ overview/      overview.spec.ts
│  ├─ documents/     documents.spec.ts · prepare.spec.ts
│  ├─ contacts/      contacts.spec.ts
│  ├─ reports/       reports.spec.ts
│  ├─ developer/     developer.spec.ts
│  ├─ support/       support.spec.ts
│  ├─ account/       account.spec.ts · settings.spec.ts
│  ├─ ui/            <module>.ui.spec.ts — one UI spec per module (baseline, 390 px, dark, module UI)
│  ├─ flows/         <area>.flow.spec.ts — user journeys from docs/USER_FLOWS.md
│  ├─ bugs/          reported-defects.spec.ts — one reproduction per reported defect (@bug)
│  └─ fixtures/      sample-agreement.png (upload fixture)
├─ reporters/        # dashboard-reporter.ts + template/assets → dashboard-report/index.html
├─ scripts/
│  ├─ save-auth.ts   # interactive login → auth/storageState.json
│  ├─ refresh-auth.ts# headless re-login with the trusted-device cookie (no OTP)
│  └─ signup.ts      # full signup + OTP helper
├─ auth/storageState.json           # signed-in session (git-ignored)
├─ docs/                            # features, test plan, test cases, user flows
├─ playwright.config.ts             # projects, reporters, retries, storage state
└─ .github/workflows/playwright.yml # CI pipeline
```

## 3. Credentials & configuration

All secrets live in **`.env`** (git-ignored). `.env.example` is the safe template.

| Variable | Purpose |
|---|---|
| `BASE_URL` | Target environment (default `https://esignpro.net`). |
| `ESIGN_NAME`, `ESIGN_COMPANY` | Signup profile (already-created workspace). |
| `ESIGN_EMAIL`, `ESIGN_PASSWORD` | Test account credentials. |
| `ESIGN_COMPANY_TYPE`, `ESIGN_COMPANY_SIZE` | Registration selects. `1–50` (label) and `1-50` (machine value) are both accepted; `RegisterPage` normalises dashes/commas. |
| `AUTH_STATE_PATH` | Session file, default `auth/storageState.json`. |
| `OTP_CODE` | One-off 6-digit code to bypass mailbox polling. |
| `GMAIL_IMAP_HOST/PORT`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional Gmail IMAP retrieval (Google **App Password**, not the account password). |
| `RUN_SIGNUP` | `true` runs the real signup test (creates a *new* workspace and sends a new verification e-mail). |
| `RUN_UPLOAD` | `true` runs tests that create a new draft (consumes a free-plan signature request). |
| `RUN_PAYMENT`, `CARD_*` | `true` runs sandbox payment cases with the Stripe **test** card. |
| `RUN_LOGIN_FLOW` | `true` runs UF-05 (real sign-in). The account allows **one active session**, so run it alone. |
| `KNOWN_BUGS` | `strict` (default): bug tests fail while the bug exists. `expect-fail`: wrapped in `test.fail()` (CI). |
| `DASHBOARD_OPEN` | `auto` (default, local only) · `always` · `never`. |

Credentials for the live test workspace are already stored in `.env`; do not commit that
file. If you regenerate it, keep `ESIGN_COMPANY_SIZE=1–50` (en dash) and use an app-specific
mailbox password for IMAP.

## 4. Authentication & session reuse

Normal runs are authenticated by a persisted Playwright storage state:

```bash
npm run auth:save     # headed Chromium: logs in, waits for the e-mailed OTP, saves state
```

`loginUser()` resolves the OTP in this order:

1. `OTP_CODE` from `.env`, if set;
2. Gmail IMAP polling (when `GMAIL_USER` + `GMAIL_APP_PASSWORD` are configured);
3. an interactive prompt in the browser/terminal.

The saved file contains the `sf_session`, `esp_device`, `m` and Stripe cookies and is
reused by every spec, except `tests/auth/*`, which override `storageState` with an empty
state to exercise the guest experience.

If the session expires, run `npm run auth:refresh`: it signs in headlessly, and the
trusted-device cookie (`esp_device`, ~90 days) skips the OTP. Only when that cookie
expires (exit code 2) do you need `npm run auth:save` again. CI runs the refresh before
every suite.

## 5. Test design conventions

- **Role-first locators** (`getByRole` with accessible names) and scoped containers; exact
  matching where the copy is duplicated. The app renders some labels twice (e.g. developer
  section links, "New envelope" h1/h2), so page objects centralise the disambiguation.
- **Hydration guard** — `BasePage.settle()` waits for network idle (capped) plus a short
  pause; the Next.js app otherwise swallows very early clicks.
- **Idempotency** — read-only assertions dominate. Data-creating specs use unique names
  (`QA Folder <timestamp>`, `QA Contact <timestamp>`).
- **Quota-aware** — builder tests open the newest existing draft via
  *Continue your most recent draft* instead of uploading; uploads are `@quota` and gated by
  `RUN_UPLOAD=true`. The Free plan allows 6 signature requests/month and drafts count.
- **Outcome over presence** — use the control, then assert what the user sees elsewhere.
  Check wording and colour for errors (`expectErrorStyled`) and contrast for text on
  documents (`expectTextReadableOn`). Never write a known defect into an expectation:
  add a `@bug` test asserting the correct behaviour instead (`src/helpers/bugs.ts`).
- **Restore shared state** — builder/flow/bug tests revert every change in `finally`.
- **Tags** — `@smoke` (fast, run on PR), `@regression`, `@e2e`, `@quota`, `@flow`, `@bug`,
  `@data` (writes to the live workspace; excluded on CI), `@ux`. Use
  `npm run test:smoke` / `npm run test:regression`, or `npx playwright test --grep @e2e`.
- **Artifacts** — trace, video and screenshot are retained on failure; JUnit is written to
  `test-results/junit.xml`.

## 6. Connecting Playwright MCP to opencode

Playwright MCP is registered globally in
`C:\Users\Global-04\.config\opencode\opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

Verify and use:

```bash
opencode mcp list          # → ✓ playwright connected
```

Then ask opencode to drive the browser (navigate, snapshot, click, fill). Exploration used
MCP; the committed suite deliberately uses the Playwright library so it is repeatable in CI.
MCP keeps its own browser profile, so its login is independent of
`auth/storageState.json`.

## 7. CI — GitHub Actions

`.github/workflows/playwright.yml` runs:

- on **pull request** → Chromium `@smoke` (without `@data`/`@bug`);
- on **push to `main`**, **nightly 02:00 UTC** and **manual dispatch** → full Chromium suite
  without `@data`, known bugs in `expect-fail` mode;
- on schedule/dispatch → `@smoke` in Firefox and WebKit.

Configure these repository secrets:

| Secret | Value |
|---|---|
| `ESIGN_NAME`, `ESIGN_COMPANY`, `ESIGN_EMAIL`, `ESIGN_PASSWORD` | Test account. |
| `ESIGN_COMPANY_TYPE`, `ESIGN_COMPANY_SIZE` | Optional, defaults apply. |
| `AUTH_STORAGE_STATE_B64` | Base64 of `auth/storageState.json` (see below). |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional, only for OTP refresh jobs. |

```powershell
# Windows — produce the secret value
[Convert]::ToBase64String([IO.File]::ReadAllBytes("auth/storageState.json"))
```

```bash
# macOS/Linux
base64 -w0 auth/storageState.json
```

The workflow restores the file to `auth/storageState.json`, refreshes it
(`scripts/refresh-auth.ts`), runs `npm ci`, `npx playwright install --with-deps chromium`,
type-checks, executes the appropriate suite, and uploads `dashboard-report/`,
`playwright-report/` and `test-results/` as artifacts for 7 days. The job summary shows the
totals and how many known bugs still reproduce.

> **The repository is public.** Reports, videos and traces show the signed-in workspace,
> and traces contain session cookies. Keep artifact retention short, or make the repo private.

## 8. Commands

| Command | Description |
|---|---|
| `npm test` | Full suite, all configured projects (Chromium by default in CI). |
| `npm run test:smoke` | `@smoke` cases only. |
| `npm run test:regression` | `@regression` cases only. |
| `npx playwright test --project=chromium --workers=1` | Serial run for debugging. |
| `npx playwright test tests/documents/prepare.spec.ts` | One module. |
| `npx playwright test --headed --debug` | Inspector / headed debugging. |
| `RUN_UPLOAD=true npx playwright test --grep @quota` | Enable quota-consuming cases. |
| `RUN_SIGNUP=true npx playwright test tests/auth/signup.spec.ts` | Real signup (needs inbox access). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test:ui-checks` | Module UI specs (`tests/ui`). |
| `npm run test:flows` | User-flow journeys (`tests/flows`). |
| `npm run test:bugs` | Known-bug reproductions (`@bug`). |
| `npm run test:ci` | Chromium + `chromium-builder` projects, everything except `@data` (what CI runs). |
| `npx playwright test --project=chromium-builder` | Only the specs that use the shared draft (run one at a time). |
| `npm run auth:save` | Interactive login with OTP → new session. |
| `npm run auth:refresh` | Headless re-login (trusted device, no OTP). |
| `npm run report` | Open the HTML report. |
| `npm run report:dashboard` | Open the test-health dashboard. |

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Tests land on `/login` | Session expired → `npm run auth:refresh` (or `auth:save` if it exits 2). |
| "Signed out on this device" / `reason=superseded` | The account signed in elsewhere (one active session). `npm run auth:refresh`, and don't run two suites at once. |
| OTP prompt times out | Set `OTP_CODE`, or configure `GMAIL_USER` + `GMAIL_APP_PASSWORD`. |
| Upload test skipped | Expected; set `RUN_UPLOAD=true` and ensure quota is available. |
| Upload stops at the prepare landing | Free-plan quota exhausted (sidebar shows `x / 6`); delete drafts or wait for renewal. |
| `getByRole` strict-mode violations | Duplicate labels exist; scope the locator (see page objects) or use `exact: true`. |
| Click swallowed on first interaction | Navigation is client-rendered; rely on `settle()`/`goto()` in the POM, avoid raw `page.goto`. |
| Company size mismatch on signup | Must be the en dash value `1–50`. |
| Native file chooser left open in MCP | Press `Escape` before further MCP actions. |
| CI fails only on session | Re-issue `AUTH_STORAGE_STATE_B64` from a fresh `auth/storageState.json`. |

## 10. Coverage & limitations

- **Automated:** 105 fully + 37 partly automated cases across every module, 14 module UI
  specs (≈ 180 checks), 8 user-flow journeys and 14 known-bug reproductions.
- **Gated by environment:** live signup (`RUN_SIGNUP`), file upload / golden-path send
  (`RUN_UPLOAD` + quota), real recipient signing and payment charging (manual charters).
- **Not automated:** actual card charges, inbound e-mail deliverability, external IdP SSO,
  partner provisioning, load/penetration testing.
- Full traceability (IDs → automated spec) is in [`docs/TEST_CASES.md`](docs/TEST_CASES.md);
  strategy, risks and exit criteria are in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).
