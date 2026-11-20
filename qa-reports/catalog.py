"""
QA scenario catalogue — the single source of truth for the coverage matrix.

One row per UNIQUE required scenario. Columns (pipe-separated):
  id | category | module | scenario | expected | impl | match | remarks

category  UNIT, INT, FUNC, E2E, REG, SEC, PERF, UX, COMP  (the nine testing categories)
impl      I  implemented — the test drives the feature and asserts the outcome
          P  partially implemented — presence-only assertions, or only a subset
             (e.g. positive path only, or controls but not behaviour)
          N  not implemented — automatable but no test yet
          M  manual — needs a human (real mailbox, real signer, legal judgement…)
          B  blocked — needs something we do not have (app source code, staging
             environment, quota, Stripe Connect, second seat, authorization)
match     regex ("¦" = alternation, since "|" separates columns) over "<file relative to tests/> :: <describe path> > <title>".
          Execution status is NEVER written here: it is computed from the actual
          run results (dashboard payloads). Empty match = no automated test.

Implementation verdicts were made by reading each spec (17 Nov 2026), not by trusting
the "✔" in docs/TEST_CASES.md: 52 tests that only assert presence are classed P.
"""

CATEGORIES = {
    "UNIT": "Unit Testing",
    "INT": "Integration Testing",
    "FUNC": "Functional Testing",
    "E2E": "E2E Testing",
    "REG": "Regression Testing",
    "SEC": "Security Testing",
    "PERF": "Performance Testing",
    "UX": "Usability & Accessibility Testing",
    "COMP": "Compatibility Testing",
}

RAW = r"""
UNIT-001|UNIT|Auth|Password policy rule (12+ chars, digit, capital, symbol) unit-tested in isolation|Validator returns weak/strong for each class and boundary|B||No application source code in this repository (black-box QA repo). Rule is exercised black-box by AUTH-005/026/027.
UNIT-002|UNIT|Auth|E-mail address validator (format, length ≤ 254, IDN)|Rejects malformed/over-long addresses|B||No source access. Black-box: AUTH-025/030/031/032.
UNIT-003|UNIT|Documents|Document-name length rule (≤ 255 chars) and error mapping|Over-limit rejected with user-facing message|B||No source access. Black-box: PREP-023 / BUG-06.
UNIT-004|UNIT|Billing|Quota arithmetic: remaining = max(limit − used, 0); exceeded ⇔ used ≥ limit|Correct for 0, limit−1, limit, limit+1|B||No source access. Black-box contract check API-007 covers the live values only, not the boundaries.
UNIT-005|UNIT|Billing|Seat proration and next-invoice calculation|Prorated amount = seats × price × remaining days / period days|B||No source access; BIL-003 shows the preview only.
UNIT-006|UNIT|Billing|Plan price calculation (per-seat, annual 12 % discount)|Team $12/seat, Business $28/seat, annual −12 %|B||No source access.
UNIT-007|UNIT|Reports|Completion-rate / median completion-time calculation|Rate = completed / sent; drafts excluded (O3)|B||No source access; defect O3 suggests drafts are counted.
UNIT-008|UNIT|Prepare|Field validation rules (email, MM/DD/YYYY date, numeric, custom regex)|Each validator accepts/rejects boundary values|B||No source access.
UNIT-009|UNIT|Prepare|Conditional-logic evaluator (is checked / equals / is not empty)|Dependent field shown/hidden correctly|B||No source access.
UNIT-010|UNIT|Security|SHA-256 document hash and hash-chained audit trail|Same file → same hash; tamper → mismatch; chain verifies|B||No source access; AUTH-022 (public verify) is manual.
UNIT-011|UNIT|Platform|Date/time formatting and relative times across time zones|No hydration mismatch (BUG-16 root cause)|B||No source access.
UNIT-012|UNIT|Billing|Payment split calculation (single / equal / custom)|Shares sum to the total; rounding to cents|B||No source access.
INT-001|INT|Documents|Library document count matches the documents API|"N documents", All documents N and row count = API|I|integration/data-consistency.*INT-001|New test.
INT-002|INT|Documents|Every API document title appears in the library|Row titles match API titles|I|integration/data-consistency.*INT-002|New test.
INT-003|INT|Contacts|Address-book and group-chip counts match the contacts API|Heading and chips equal API totals|I|integration/data-consistency.*INT-003|New test.
INT-004|INT|Billing|Sidebar plan-usage % matches billing usage API|Widget % = used/limit|I|integration/data-consistency.*INT-004|New test.
INT-006|INT|Account|Profile page shows the API user record|Name and e-mail equal /me|I|integration/data-consistency.*INT-006|New test.
API-001|INT|API|/me contract, no sensitive fields, < 2 s|200 JSON, typed fields|I|api/api-contract.*API-001|New test.
API-002|INT|API|/documents contract and tenant isolation|Every item typed and in my organization|I|api/api-contract.*API-002|New test.
API-003|INT|API|Document by id matches list entry|Same id/title/status|I|api/api-contract.*API-003|New test.
API-004|INT|API|Unknown document id → 404 clean message|404 with detail, no stack trace|I|api/api-contract.*API-004|New test.
API-005|INT|API|Malformed ids rejected without 5xx|4xx, no SQL/trace text|I|api/api-contract.*API-005|New test.
API-006|INT|API|/contacts items, total and group counts agree|total = items; counts = per-group items|I|api/api-contract.*API-006|New test.
API-007|INT|API|Billing usage arithmetic is internally consistent|remaining and exceeded derived correctly|I|api/api-contract.*API-007|New test (black-box counterpart of UNIT-004).
API-008|INT|API|Webhook event catalogue lists documented, unique events|document.completed/created present|I|api/api-contract.*API-008|New test.
API-010|INT|API|JSON content type and nosniff on API responses|application/json + nosniff|I|api/api-contract.*API-010|New test.
REP-010|INT|Reports|Report figures agree with library (drafts not counted as sent)|Scorecards match library statuses (O3, O5)|N||Known observations O3/O5 — candidate for a consistency test once a sent envelope exists.
INT-007|INT|Auth|E-mail OTP delivery (third-party mail) within 2 min|OTP e-mail arrives and code works|M||Needs a mailbox (GMAIL_* not configured). AUTH-008/009.
INT-008|INT|Billing|Stripe test-mode card form integration|Card validated by Stripe; token returned|I|billing/payments.spec.*BIL-004|Stripe test-mode Embedded Checkout (setup and subscription).
INT-009|INT|Payments|Stripe Connect onboarding round-trip|Redirect to Stripe, status returns connected|M||ACC-023; external onboarding.
INT-010|INT|Integrations|Storage connectors (Google Drive / Dropbox) export|Export written to connector|B||Connectors disabled on this deployment ("Not available").
INT-013|INT|Data|Database persistence of writes (direct DB check)|Rows persisted as shown in UI|B||No database access; persistence verified via UI reload/API instead (ACC-003, PREP-018).
AUTH-001|FUNC|Auth|Landing page renders|Hero, CTA, Log in, pricing, footer; title eSignPro|I|public/public.spec.*landing page renders|
AUTH-002|FUNC|Auth|Navigate to registration from landing|/register with "Create your workspace"|I|flows/guest.flow.*UF-01|Covered via pricing CTA journey.
AUTH-003|FUNC|Auth|Registration form fields present|All fields and Create account visible|P|auth/signup.spec.*renders the create-account form|Presence-only.
AUTH-004|FUNC|Auth|Empty registration submit blocked|Stays; "Name and company are required"|I|auth/signup.spec.*blocks submission when the form is empty|
AUTH-005|FUNC|Auth|Password strength meter|Weak hint vs Strong/Excellent|I|auth/signup.spec.*password strength meter|
AUTH-006|FUNC|Auth|Terms must be accepted|Stays; "Accept the terms and disclosure"|I|auth/signup.spec.*requires accepting the terms|
AUTH-007|FUNC|Auth|Company type/size options|Options listed; selection persists|P|auth/signup.spec.*requires accepting the terms|Options only selected via fillForm; inventory not asserted.
AUTH-008|E2E|Auth|Successful signup → verify|Account created; OTP e-mail arrives|I|auth/signup.spec.*creates a workspace|Runs every time since 18 Nov: unique qa.signup+<ts>@example.com, stops at the OTP page (one unverified workspace per run).
AUTH-009|FUNC|Auth|Verify with correct OTP|Redirect to /overview|M||Needs mailbox OTP.
AUTH-010|FUNC|Auth|Verify with wrong OTP|Inline error; stays on verify|M||Reaching /login/verify needs a real sign-in (single active session).
AUTH-011|FUNC|Auth|Resend verification code|Toast; new code; old invalid|M||Needs mailbox.
AUTH-012|FUNC|Auth|Login with valid credentials|Redirect to /overview|I|flows/guest.flow.*UF-05|Runs in chromium-account (single active session); session-restore teardown signs back in.
AUTH-013|FUNC|Auth|Login with wrong password|Stays; error; no session|I|auth/login.spec.*rejects an invalid password|
AUTH-014|FUNC|Auth|Empty login submit|No navigation; required fields flagged|I|auth/login.spec.*AUTH-014|Native required validation on e-mail and password; focus on e-mail.
AUTH-015|UX|Auth|Show/hide password|Becomes readable, toggles|I|ui/auth.ui.spec.*password fields are masked|
AUTH-016|FUNC|Auth|Remember this device|OTP skipped on next login|M||Needs fresh sign-in + OTP.
AUTH-017|FUNC|Auth|Forgot password page|/login/forgot with e-mail field|P|public/public.spec.*forgot-password page|Presence-only; e-mail delivery manual.
AUTH-018|FUNC|Auth|Tab switch between sign in / create account|Correct page and tab state|I|auth/signup.spec.*switch to the sign-in tab|
AUTH-019|SEC|Auth|Sign out ends the session server-side|Redirect; back button cannot reopen; old cookie rejected|I|security/session.spec.*SESS-003|New test; gated RUN_SIGNOUT (ends the shared session), run alone.
AUTH-020|SEC|Auth|Protected route redirect for guests|/login?next=…|I|public/public.spec.*guest is redirected from|
AUTH-021|FUNC|Auth|Public pages render|200 and correct H1|I|public/public.spec.*(/trust¦/verify¦/security¦/legal¦/changelog) renders|
AUTH-022|FUNC|Auth|Verify a signed document (/verify upload)|Hash match; tampered rejected|B||Needs a completed (signed) envelope; none exists (quota 6/6).
AUTH-023|FUNC|Auth|Unknown route as guest|Redirect to login|I|public/public.spec.*unknown routes send guests|
AUTH-024|FUNC|Auth|SSO / MFA notice on login|Notices visible|I|auth/login.spec.*AUTH-024|
AUTH-025|FUNC|Auth|Registration rejects malformed e-mail before submit|Stays; field invalid; no request|I|auth/auth-validation.*AUTH-025|New test (writes blocked).
AUTH-026|FUNC|Auth|Password length boundary 11 vs 12|11 → hint; 12 → accepted|I|auth/auth-validation.*AUTH-026|New boundary test. 11-char case fails: BUG-21.
AUTH-027|FUNC|Auth|Password missing a character class not rated strong|Not Strong/Excellent|I|auth/auth-validation.*AUTH-027|New negative tests (3). Fails: BUG-21.
AUTH-028|FUNC|Auth|Weak password blocks account creation|Stays; message|I|auth/auth-validation.*AUTH-028|New test.
AUTH-029|FUNC|Auth|Whitespace-only name/company treated as empty|"Name and company are required"|I|auth/auth-validation.*AUTH-029|New edge case.
AUTH-030|FUNC|Auth|Sign-in with malformed e-mail does not submit|Field invalid; no request|I|auth/auth-validation.*AUTH-030|New test.
AUTH-031|FUNC|Auth|Password reset with malformed e-mail blocked|Field invalid; no request|I|auth/auth-validation.*AUTH-031|New test.
AUTH-032|FUNC|Auth|Over-long (255+) e-mail handled without crash|No uncaught error|I|auth/auth-validation.*AUTH-032|New boundary test.
NAV-001|FUNC|Navigation|Sidebar exposes all modules|All links visible|P|navigation/navigation.spec.*exposes every module|Presence-only.
NAV-002|FUNC|Navigation|Sidebar navigation works|/contacts loads, marked active|I|navigation/navigation.spec.*navigates to Contacts|
NAV-003|FUNC|Navigation|Account & help menu|All items listed|P|navigation/navigation.spec.*account and help menu|Presence-only.
NAV-004|FUNC|Navigation|Global search shortcut|Dialog opens focused|I|ui/navigation.ui.spec.*search dialog focuses the input|
NAV-005|FUNC|Navigation|Global search results|Grouped results; Enter opens|I|navigation/navigation.spec.*global search returns grouped results|
NAV-006|FUNC|Navigation|Theme toggle (and persistence)|Theme switches and persists|I|flows/personalise.flow.*NAV-006¦ui/navigation.ui.spec.*theme toggle|Persists after reload (data-theme); restored after the test.
NAV-007|FUNC|Navigation|Collapsible sidebar|Collapses/expands|I|flows/personalise.flow.*NAV-007¦ui/navigation.ui.spec.*sidebar collapses|Fold persists after reload (localStorage sf.sidebar.folded).
NAV-008|COMP|Navigation|Mobile drawer|Drawer opens/closes; links usable|I|compatibility/viewports.*small phone.*COMP-002|New: navigation reachable at 360 px.
NAV-009|FUNC|Navigation|Notifications popover|Popover; link to /notifications|I|navigation/navigation.spec.*notifications bell|
NAV-010|FUNC|Navigation|Product tour|Step dialog; Skip closes|I|navigation/navigation.spec.*product tour|
OVR-001|FUNC|Overview|Dashboard loads|Heading, summary|P|overview/overview.spec.*workspace summary|Presence-only.
OVR-002|FUNC|Overview|KPI cards show values|Each KPI has a value|I|ui/overview.ui.spec.*every KPI card shows a value|
OVR-003|FUNC|Overview|Dashboard widgets|Widgets visible|P|overview/overview.spec.*(template, volume, spend¦BUG-33)|Presence + volume weeks consecutive (fails: BUG-33, W37 missing).
OVR-004|FUNC|Overview|New envelope action|Routes to /documents/prepare|I|overview/overview.spec.*starts a new envelope|
OVR-005|FUNC|Overview|Browse templates|Templates folder opens|I|overview/overview.spec.*opens the templates library|
OVR-006|UX|Overview|Chart accessibility (data table)|Data alternative exposed|I|ui/overview.ui.spec.*volume chart has an accessible data alternative|
OVR-007|INT|Overview|Plan renewal copy matches plan|"<Plan> · renews <date>" = billing period|I|overview/overview.spec.*OVR-007|Compared with /api/proxy/billing/usage plan_name and period_end.
OVR-008|FUNC|Overview|Attention item navigation|Opens relevant page|I|overview/overview.spec.*OVR-008|Headline count = list length; first item opens its page (seats → /account/billing).
DOC-001|FUNC|Documents|Library renders|Heading, search, toolbar|P|documents/documents.spec.*renders folders, views and toolbar|Presence-only.
DOC-002|FUNC|Documents|Folder/view links filter the list|Drafts/Completed views list matching envelopes|I|documents/library-search.*DOC-002|New behaviour test (was presence-only).
DOC-003|FUNC|Documents|Filter dimensions offered|All selects with options|I|documents/documents.spec.*exposes every filter dimension|
DOC-004|FUNC|Documents|Filter by status narrows the list|Rows match status; reset restores|I|documents/library-search.*DOC-004|New test. Drafts filter fails: BUG-23.
DOC-005|FUNC|Documents|Filter by type/time/owner|Result set narrows|N||Needs varied data (all 6 docs are identical drafts).
DOC-006|FUNC|Documents|Sort order|Recent = updated desc; Name = alphabetical|I|documents/library-search.*DOC-006|New outcome tests; legacy test only checked the select value.
DOC-007|FUNC|Documents|Create folder|Folder appears|I|documents/documents.spec.*creates a folder|@data — excluded on production runs.
DOC-008|FUNC|Documents|Folder name validation (blank/duplicate)|Inline error; not created|I|documents/documents.spec.*DOC-008¦flows/library-lifecycle.*BUG-32|Blank/whitespace blocked; duplicate name accepted (BUG-32, fixed folder name so runs add at most one).
DOC-009|E2E|Documents|Upload & prepare|Draft created; builder opens|I|documents/upload.spec.*DOC-009|Quota-aware: uploads, verifies the new draft, moves it to Trash.
DOC-010|FUNC|Documents|Upload unsupported file rejected|Clear error; no draft|B||Upload path blocked by quota (402) before type validation.
DOC-011|FUNC|Documents|Templates folder|Templates view + catalog|I|documents/documents.spec.*opens the templates folder|
DOC-012|FUNC|Documents|Row content|Title, ENV id, pages, status, signers|I|integration/data-consistency.*INT-002|Row titles checked against API.
DOC-013|FUNC|Documents|Archive / Trash lifecycle|Moves and restores|I|flows/library-lifecycle.*(DOC-013¦BUG-29¦BUG-30)|On a copy: archive → unarchive → trash → erased. No Unarchive label (BUG-29), no Restore in Trash (BUG-30).
DOC-014|FUNC|Documents|Favourites / sharing views|Appears in Favourites|N||Writes; sharing needs a second seat.
DOC-015|FUNC|Documents|Empty state for no match + clear|Friendly empty state; clearing restores|I|documents/library-search.*DOC-015|New test.
DOC-016|FUNC|Documents|Pagination|Showing X of Y; page controls|B||Only 6 documents; needs > page size.
DOC-017|FUNC|Documents|Row actions menu|All actions listed|I|documents/library-actions.spec.*row actions menu lists|
DOC-018|FUNC|Documents|Row actions behaviour (duplicate, rename, move, download, print)|Each applies|P|flows/library-lifecycle.*DOC-018|Duplicate, rename, move, archive, delete asserted via UI + API; download/print not yet.
DOC-019|UX|Documents|Layout toggle & bulk selection|Layout switches; bulk bar|P|documents/library-actions.spec.*list/grid layout|Controls only.
DOC-020|FUNC|Documents|Form catalog|Dialog; add copies form|P|documents/library-actions.spec.*form catalog opens|Dialog only.
DOC-021|SEC|Documents|Unknown document id shows not-available|No data leak|I|documents/library-actions.spec.*unknown document id|
DOC-022|FUNC|Documents|Quota exhausted blocks upload with guidance|402 + upgrade guidance|P|documents/upload.spec|The refusal branch executes only when the monthly quota is used up (plan Team, 60/month, since 18 Nov).
DOC-023|FUNC|Documents|Search documents by title / ENV id|Matching rows only|I|documents/library-search.*DOC-023|New tests.
TPL-001|FUNC|Templates|Save draft as template|Template listed|P|bugs/reported-defects.*BUG-07|Setup step of BUG-07 (@data).
TPL-002|FUNC|Templates|Template name is unique|Duplicate rejected|I|bugs/reported-defects.*BUG-07|@data; BUG-07.
TPL-003|FUNC|Templates|Rename template to existing name rejected|Rejected|M||BUG-07 rename path; manual.
TPL-004|FUNC|Templates|Delete a template|Removed with feedback|I|bugs/reported-defects.*BUG-10|BUG-10.
TPL-005|E2E|Templates|Start an envelope from a template|Draft with fields|B||Quota.
PREP-001|FUNC|Prepare|New envelope landing|Choose file, templates, explainer|P|documents/prepare.spec.*offers upload, templates|Presence-only.
PREP-002|E2E|Prepare|Upload opens builder|Draft; builder|I|documents/upload.spec.*PREP-002|Quota-aware: uploads, verifies the builder, moves the draft to Trash.
PREP-003|FUNC|Prepare|Recipients panel|Add / Manage recipients; status|P|documents/prepare.spec.*exposes recipients, field palette|Presence-only.
PREP-004|FUNC|Prepare|Add recipient & roles|Recipient with role|N||Writes to shared draft; second-recipient data planned.
PREP-005|FUNC|Prepare|Manage recipients persist|Rename/reorder/remove persist|P|documents/builder-details.spec.*manage-recipients dialog|Dialog inventory only.
PREP-006|FUNC|Prepare|Field palette inventory|All 16 field types|P|ui/prepare.ui.spec.*field search filters the palette|Subset.
PREP-007|FUNC|Prepare|Place signature field|Placed; count increments; autosave|I|documents/prepare.spec.*places a signature field|
PREP-008|FUNC|Prepare|Assign field to recipient|Bound to recipient|N||Needs 2 recipients.
PREP-009|FUNC|Prepare|Validation/required rules|Rules persist; enforced|P|documents/builder-details.spec.*inspector exposes validation|Options only.
PREP-010|FUNC|Prepare|Conditional logic|Show/hide in preview|P|documents/builder-details.spec.*inspector exposes validation|Operators only.
PREP-011|FUNC|Prepare|Pages panel|Add/reorder/delete pages|P|documents/builder-details.spec.*canvas toolbar and pages panel|Controls only.
PREP-012|FUNC|Prepare|Inspector tools (duplicate, align, undo)|Applies and undoes|P|ui/prepare.ui.spec.*zoom controls|Zoom only.
PREP-013|FUNC|Prepare|Download PDF / save as template|PDF downloads|P|documents/builder-details.spec.*canvas toolbar|Controls only.
PREP-014|FUNC|Prepare|Preview signer view|Opens preview with fields|I|flows/envelope-preparation.flow.*UF-19|
PREP-015|FUNC|Prepare|Save and close|Returns to library|I|flows/library.flow.*UF-16|
PREP-016|FUNC|Prepare|Canvas toolbar & pages panel present|All tools present|P|documents/builder-details.spec.*canvas toolbar and pages panel|Presence-only.
PREP-017|FUNC|Prepare|Add recipient from contacts|Prefilled|N||Writes to draft.
PREP-018|FUNC|Prepare|Rename & autosave survive reload|Persists|I|flows/envelope-preparation.flow.*UF-19|
PREP-019|UX|Prepare|Field text readable on dark pages|≥ 3:1 contrast|I|bugs/reported-defects.*BUG-01|BUG-01.
PREP-020|FUNC|Prepare|Favourite moves a field to the top|Favourites first|I|bugs/reported-defects.*BUG-02|BUG-02.
PREP-021|FUNC|Prepare|Warn before opening another document|Confirmation|I|bugs/reported-defects.*BUG-04|BUG-04.
PREP-022|FUNC|Prepare|Placeholder shown on canvas|Placeholder visible|I|bugs/reported-defects.*BUG-05|BUG-05.
PREP-023|FUNC|Prepare|Document-name length validation|Rejected with clear message|I|bugs/reported-defects.*BUG-06|BUG-06.
PREP-024|E2E|Prepare|Place & configure a field journey|All checkpoints|I|flows/envelope-preparation.flow.*UF-19|Same test as UF-19 — counted once under E2E UF-19.
WF-001|FUNC|Workflow|Workflow page loads|All sections|P|documents/prepare.spec.*moves to the workflow step|Presence-only.
WF-002|FUNC|Workflow|Sequential vs parallel routing|Exactly one mode pressed; persists|P|ui/workflow.ui.spec.*routing toggle|State only; persistence not asserted.
WF-003|FUNC|Workflow|Invite preview updates live|Preview reflects subject|I|ui/workflow.ui.spec.*invite preview reflects the subject|
WF-004|FUNC|Workflow|Payment request|Saved with payment field|B|documents/builder-details.spec.*payment split options|Blocked without Stripe Connect; options only.
WF-005|FUNC|Workflow|Before-you-send checklist|Pending items flagged|P|ui/workflow.ui.spec.*before-you-send checklist|Icons only.
WF-006|FUNC|Workflow|Expiration options (reminder cadence removed 20 Nov 2026)|Expiry options offered; no reminder cadence|P|documents/builder-details.spec.*expiry and payment split|Options only; persistence not asserted.
WF-007|FUNC|Workflow|Branding theme|Preview reflects theme|B||Branding not on Free plan.
WF-008|FUNC|Workflow|Delivery simulation|Timeline shown|P|documents/prepare.spec.*moves to the workflow step|Section presence.
WF-009|FUNC|Workflow|Send blocked without recipient/fields|Blocked; nothing sent|N||Safe to automate only if the block is certain; risk of sending.
WF-010|E2E|Workflow|Send envelope golden path|Waiting for others; invite received|B||Quota + real recipient mailbox.
WF-011|FUNC|Workflow|Missing recipient e-mail is blocking|Error colour + wording|I|bugs/reported-defects.*BUG-08|BUG-08.
WF-012|UX|Workflow|Recipients edited in one place|Read-only list|I|bugs/reported-defects.*BUG-09|BUG-09 (product decision).
SIGN-001|FUNC|Signer|Preview modes Desktop/Mobile|Layout switches|I|signer/signer.spec.*toggles desktop and mobile|
SIGN-002|FUNC|Signer|Start signing & required fields|Progress updates|P|signer/signer.spec.*shows signing controls|Preview-only controls.
SIGN-003|FUNC|Signer|Disclosure consent required|Consent before finish|M||Needs a sent envelope.
SIGN-004|FUNC|Signer|Decline flow|Declined; sender notified|B||Needs a sent envelope (quota).
SIGN-005|FUNC|Signer|Reassign|New recipient invited|B||Needs a sent envelope.
SIGN-006|E2E|Signer|Finish & certificate|Signed PDF + certificate|B||Needs a sent envelope.
SIGN-007|FUNC|Signer|Back to editing|Returns to builder|I|signer/signer.spec.*returns to the builder|
SIGN-008|FUNC|Signer|Preview every recipient's view|All-recipients view|I|bugs/reported-defects.*BUG-03|BUG-03.
CON-001|FUNC|Contacts|Address book renders|Columns present|P|contacts/contacts.spec.*renders the address book columns|Presence-only.
CON-002|FUNC|Contacts|New contact dialog fields|All fields|I|contacts/contacts.spec.*opens the new-contact form|Asserts options too.
CON-003|FUNC|Contacts|Role & group options|Exact options|I|contacts/contacts.spec.*opens the new-contact form|Same test as CON-002 — options asserted.
CON-004|FUNC|Contacts|Create contact|Saved; detail page|I|contacts/contacts.spec.*creates a contact|@data — excluded on production runs.
CON-005|FUNC|Contacts|Required/format validation|Inline errors; nothing saved|I|contacts/contacts.spec.*rejects invalid email|Blank name → BUG-17; duplicate e-mail not covered.
CON-006|FUNC|Contacts|Contact detail tabs|Tabs and actions|P|contacts/contacts.spec.*creates a contact|Only via @data test.
CON-007|FUNC|Contacts|Edit contact persists|Values persist|I|flows/contacts.flow.*CON-007|Fixed test contact (reused, not re-created each run).
CON-008|FUNC|Contacts|Add as recipient|Prefilled recipient|I|contacts/add-as-recipient.*CON-008|Adds to the newest draft without asking; notice names no envelope (BUG-31). Recipient removed afterwards.
CON-009|FUNC|Contacts|Search contacts (list)|Matching rows; empty state|I|contacts/contacts-search.*CON-009|New tests (3).
CON-010|FUNC|Contacts|Group filter chips|Rows = chip counts|I|contacts/contacts-search.*CON-010|New test.
REP-001|FUNC|Reports|Reports dashboard|Scorecards, ranges|I|reports/reports.spec.*analytics scorecard|
REP-002|FUNC|Reports|Date ranges reload|Selection sticks|I|reports/reports.spec.*switches the reporting period|
REP-003|FUNC|Reports|Report sections listed|All sections|P|reports/reports.spec.*exposes every report section|Presence-only.
REP-004|FUNC|Reports|Recipient report|Table columns|I|reports/reports.spec.*navigates to the recipient report|
REP-005|FUNC|Reports|Document/template reports|Columns|P|reports/report-sections.spec.*(documents report¦templates report)|Presence-only.
REP-006|FUNC|Reports|Custom report builder|Dimension becomes a column|I|reports/report-sections.spec.*custom report builder|
REP-007|FUNC|Reports|Export report|Valid file downloads|I|reports/reports.spec.*REP-007|invites-<range>.csv; every outcome count equals the on-screen figure.
REP-008|UX|Reports|Empty period|Zeroed metrics; no NaN|I|ui/reports.ui.spec.*Reports.*meets the UI baseline|UI baseline checks NaN/undefined.
REP-009|FUNC|Reports|All reports catalogue|6 CSV reports|P|reports/report-sections.spec.*all reports lists|Presence-only.
SUP-001|FUNC|Support|Support dashboard|Counters, filters|P|support/support.spec.*shows ticket counters|Presence-only.
SUP-002|FUNC|Support|New ticket dialog|Fields|I|support/support.spec.*opens a new ticket|
SUP-003|FUNC|Support|Priority/category inventory|Exact options|I|support/support.spec.*opens a new ticket|Same test as SUP-002.
SUP-004|FUNC|Support|Empty ticket submit explains what is missing|Validation message|I|ui/support.ui.spec.*BUG-11|BUG-11.
SUP-005|FUNC|Support|Create ticket + SLA|Listed under Open|I|flows/support.flow.*SUP-005|Ticket labelled [QA automation], P4; Open counter +1; SLA shown; resolved at the end. 'Close ticket' only closes the panel.
SUP-006|FUNC|Support|Filters / sort / chips|Combine, reset, exclusive chips|I|support/support-search.*SUP-006|New tests (empty-queue data only).
SUP-007|FUNC|Support|Queue controls|All present|I|support/support-queue.spec.*search, sort, export|
SUP-008|FUNC|Support|Default priority P3|P3 · Normal|I|support/support-queue.spec.*defaults to P3|
SUP-009|FUNC|Support|Ticket search no-match empty state|Empty state; no errors|I|support/support-search.*SUP-009|New test.
ACC-001|FUNC|Account|Profile loads|Fields; Save disabled|I|account/account.spec.*shows profile details|
ACC-002|FUNC|Account|Profile values|Name/e-mail match account|I|integration/data-consistency.*INT-006|Strengthened by INT-006.
ACC-003|FUNC|Account|Edit profile persists|Persists and reverts|I|flows/account.flow.*UF-39|
ACC-004|UX|Account|Appearance control|One option checked|I|ui/account.ui.spec.*colour mode has exactly one¦flows/personalise.flow.*ACC-004|Shell toggle is reflected in the account Colour mode.
ACC-005|FUNC|Account|Signature dialog|Tabs, Adopt|P|account/account.spec.*appearance, password and signature|Presence-only.
ACC-006|FUNC|Account|Adopt signature|Saved as default|I|flows/account.flow.*ACC-006|Typed signature adopted → Default after reload → removed. Skips if the account already has one.
ACC-007|SEC|Account|Change password end-to-end|Old password rejected|M||Changes the shared account's password.
ACC-008|FUNC|Account|Change password validation|Inline errors|P|account/account.spec.*change password cannot continue|Empty current only.
ACC-009|FUNC|Account|Login & security controls|Sections present|P|account/account.spec.*shows login & security controls|Presence-only.
ACC-010|SEC|Account|Enable 2FA / passkey|Setup completes|M||Changes account security; needs authenticator.
ACC-011|SEC|Account|Device session control|Session revoked|M||Kills the shared session.
ACC-012|FUNC|Account|Notification preferences|8 switches|I|account/account.spec.*lists notification preferences¦flows/account.flow.*ACC-012|Weekly summary toggled, persisted after reload, reverted.
ACC-013|FUNC|Account|Integrations page|Catalogue|P|account/settings.spec.*integrations page|Presence-only.
ACC-014|FUNC|Account|Organization & teams|People, teams, palette|P|account/settings.spec.*organization page lists|BUG-12 separate.
ACC-015|FUNC|Account|Audit trail|Filters, pagination|P|account/settings.spec.*audit trail|Presence-only.
ACC-016|FUNC|Account|Payments & branding pages|Render|I|account/settings.spec.*payments page offers Stripe|
ACC-017|FUNC|Account|Notifications centre|Filters, bulk actions|I|account/settings.spec.*notifications centre|
ACC-018|SEC|Account|Deep link as guest|Redirect; no data|I|public/public.spec.*redirected from /account/security|
ACC-019|SEC|Account|Remembered browsers|Forget works|P|account/settings.spec.*security page lists sessions|Controls only.
ACC-020|FUNC|Account|Organization field palette|Palette change reflected|P|account/settings.spec.*organization page lists|16 types listed only.
ACC-021|FUNC|Account|Invite member validation|Next disabled when empty|I|account/settings.spec.*invite-member dialog requires|
ACC-022|FUNC|Account|Branding plan gate|Not included in Free|P|account/settings.spec.*branding is gated|Presence-only.
ACC-023|INT|Account|Stripe Connect for payments|Redirect to Stripe|M||External onboarding (= INT-009).
BIL-001|FUNC|Billing|Billing page|Plan, usage, invoices|P|billing/billing.spec.*shows billing details|Presence-only.
BIL-002|FUNC|Billing|Plan catalogue & current plan pre-selected|Prices; Free pre-selected|I|ui/billing.ui.spec.*BUG-14|BUG-14.
BIL-003|FUNC|Billing|Seats dialog cost preview|Preview|P|ui/billing.ui.spec.*add-seats dialog previews|Presence-only (no arithmetic, see UNIT-005).
BIL-004|FUNC|Billing|Payment method dialog|Card form|I|billing/payments.spec.*BIL-004|Stripe test-mode Checkout; card appears after the webhook (polled). Adds one test card per run (no remove action in the UI).
BIL-005|FUNC|Billing|No payment method state|Empty states|P|billing/billing.spec.*shows billing details|
BIL-006|FUNC|Billing|Enterprise trial|Trial terms|N||Would start a trial on production.
BIL-007|SEC|Billing|Change plan guard without card|Payment prompted; nothing applied|I|billing/payments.spec.*BIL-007|State machine: upgrade charged once per period; downgrade scheduled for renewal; Keep plan cancels it.
BIL-008|FUNC|Billing|Invoices list|Invoice list|I|billing/billing.spec.*BIL-008|List count = heading; detail opens; Subtotal + Tax = Total; receipt actions offered.
BIL-009|FUNC|Billing|Billing details save on blur|Persists|I|flows/billing.flow.*BIL-009|Billing e-mail (account mailbox / its +alias) persists after blur. Observation: clearing the field is not saved.
BIL-010|FUNC|Billing|Invoice / PO option|Form shown|N||
BIL-012|FUNC|Billing|Change-plan preview prorates the price difference over the rest of the period|Prorated today = (new - current price) x remaining / period|I|billing/payments.spec.*BIL-012|New 18 Nov (black-box counterpart of UNIT-005).
BIL-011|FUNC|Billing|Billing API outage handling|Banner + Retry|M||Needs fault injection (could use page.route in a future test).
NF-007|FUNC|Platform|404 route when signed in|"That page isn't here"|I|navigation/navigation.spec.*unknown routes return the 404|
NF-010|FUNC|Platform|Error/offline state|Friendly error; retry|P|navigation/navigation.spec.*NF-010|Session survives a dropped connection (every browser). Offline navigation shows the browser error page — no in-app offline notice (observation).
UF-01|E2E|Guest|Discover → choose a plan|Plan kept on /register|I|flows/guest.flow.*UF-01|
UF-02|E2E|Guest|Sign up → verify → first visit|Overview greets new workspace|P|auth/signup.spec.*creates a workspace|Signup to the OTP page is automated; OTP entry needs a mailbox (GMAIL_* empty).
UF-03|E2E|Guest|Sign in|Trusted device skips OTP|I|flows/guest.flow.*UF-05|Trusted-device sign-in, no OTP.
UF-04|E2E|Guest|Forgot password end-to-end|Link single-use, 30 min|M||Mailbox.
UF-05|E2E|Guest|Deep link as guest returns after sign-in|Lands on /contacts|I|flows/guest.flow.*UF-05|Runs in chromium-account.
UF-06|E2E|Guest|Verify a signed document|Hash result|B||Needs completed envelope.
UF-07|E2E|Guest|Sign out / session expiry|Back button cannot reopen|I|security/session.spec.*SESS-00[13]|New: SESS-001 (expiry) + SESS-003 (gated sign-out).
UF-08|E2E|Shell|Find anything|Results; Enter opens|I|navigation/navigation.spec.*global search returns grouped results|
UF-09|E2E|Shell|Notifications journey|Read state persists|P|account/settings.spec.*notifications centre|
UF-10|E2E|Shell|Product tour|Skip closes|I|navigation/navigation.spec.*product tour|
UF-11|E2E|Shell|Personalise (theme, sidebar)|Persist|I|flows/personalise.flow.*UF-11|Theme (account-wide) and sidebar fold persist after reload; both restored.
UF-12|E2E|Documents|Upload → draft|Draft created|I|documents/upload.spec|Quota-aware upload journey.
UF-13|E2E|Documents|Start from a template|Envelope with template fields|B||Quota.
UF-14|E2E|Documents|Organise (search, filter, sort, folders…)|Counts update|I|documents/library-search.*¦flows/library-lifecycle.*UF-14|Search/filter/sort + folder/move/archive/trash lifecycle on a copy.
UF-15|E2E|Documents|Row actions journey|Each action has effect|I|documents/library-actions.spec.*row actions menu¦flows/library-lifecycle.*UF-15|Duplicate, rename, move, archive, delete each verified.
UF-16|E2E|Documents|Library → builder → back|Draft listed|I|flows/library.flow.*UF-16|
UF-17|E2E|Prepare|Manage recipients journey|Cards update|P|documents/builder-details.spec.*manage-recipients|
UF-18|E2E|Prepare|Find and favourite fields|Favourites first|I|ui/prepare.ui.spec.*(Favourites tab¦favourite toggle)|BUG-02 tracked separately.
UF-19|E2E|Prepare|Place & configure a field|All checkpoints|I|flows/envelope-preparation.flow.*UF-19|
UF-20|E2E|Prepare|Pages journey|Thumbnails follow|P|documents/builder-details.spec.*pages panel|
UF-21|E2E|Prepare|Rename document|Title updates; limit enforced|I|flows/envelope-preparation.flow.*UF-19|Rename is a UF-19 checkpoint; limit = BUG-06.
UF-22|E2E|Prepare|Preview as recipients|Each recipient view|I|flows/envelope-preparation.flow.*UF-19|BUG-03 tracked separately.
UF-23|E2E|Templates|Save as template|Unique names|I|bugs/reported-defects.*BUG-07|@data.
UF-24|E2E|Prepare|Leave / switch document|Warning|I|bugs/reported-defects.*BUG-04|
UF-25|E2E|Workflow|Configure delivery|Selections persist|P|ui/workflow.ui.spec.*invite preview|
UF-26|E2E|Workflow|Pre-send check & send|Status Waiting for others|B||Quota + mailbox.
UF-27|E2E|Workflow|Track & manage sent envelopes|Remind/void|B||No sent envelopes.
UF-28|E2E|Signer|Sign (recipient)|Certificate + PDF|B||No sent envelopes.
UF-29|E2E|Signer|Decline / reassign|Audit entry|B||No sent envelopes.
UF-30|E2E|Signer|In-person signing|Identity captured|B||No sent envelopes.
UF-31|E2E|Signer|Pay while signing|Payment recorded|B||Stripe Connect.
UF-32|E2E|Contacts|Build address book|Find created contact|I|flows/contacts.flow.*UF-32|@data — excluded on production runs.
UF-33|E2E|Contacts|Contact → envelope|Recipient prefilled|I|contacts/add-as-recipient.*CON-008|See CON-008 / BUG-31.
UF-34|E2E|Reports|Analyse activity|Every section loads|I|flows/reports.flow.*UF-34|
UF-38|E2E|Support|Raise and track a ticket|Ticket listed|I|support/support.spec.*validates that a ticket cannot be submitted¦flows/support.flow.*UF-38|Create → listed Open with SLA → resolved.
UF-39|E2E|Account|Profile edit journey|Persists, reverts|I|flows/account.flow.*UF-39|
UF-40|E2E|Account|Signature journey|Offered when signing|P|account/account.spec.*signature settings¦flows/account.flow.*UF-40|Adopt/default/remove automated; 'offered when signing' needs a live signing session.
UF-41|E2E|Account|Security journey|Re-auth enforced|P|account/account.spec.*change password cannot continue|Validation only.
UF-42|E2E|Account|Organisation journey|Invite sent|P|account/settings.spec.*invite-member dialog|Validation only.
UF-43|E2E|Account|Audit journey|Rows match filter|P|account/settings.spec.*audit trail|
UF-44|E2E|Account|Payments & branding journey|Plan gate|P|account/settings.spec.*branding is gated|
UF-45|E2E|Billing|Review and change plan|Nothing applied on cancel|I|flows/billing.flow.*UF-45|
UF-46|E2E|Billing|Seats & payment method|Card validation|I|billing/payments.spec.*BIL-004|Payment method via Stripe test mode.
REG-001|REG|Suite|Smoke regression (@smoke) on Chromium|All smoke tests pass|I|@smoke|Computed over every @smoke test in the run.
REG-002|REG|Suite|Full Chromium regression (excluding @data)|No unexpected failures vs previous run|I|.*|Computed over the whole run; compared with 16 Nov 2026 run.
REG-003|REG|Suite|Builder regression (shared draft, serial project)|Builder specs pass and restore the draft|I|(documents/prepare¦documents/builder-details¦ui/prepare¦ui/workflow¦ui/signer¦signer/signer¦flows/envelope-preparation¦flows/library)|
REG-004|REG|Suite|Cross-browser smoke regression (Firefox, WebKit, Pixel 7)|Smoke passes on each engine|I|@smoke|Computed from the cross-browser run.
REG-B01|REG|Prepare|Retest BUG-01 field text on black page|Fixed → passes|I|bugs/reported-defects.*BUG-01|
REG-B02|REG|Prepare|Retest BUG-02 favourites to top|Fixed → passes|I|bugs/reported-defects.*BUG-02|
REG-B03|REG|Signer|Retest BUG-03 all-recipients preview|Fixed → passes|I|bugs/reported-defects.*BUG-03|
REG-B04|REG|Prepare|Retest BUG-04 switch-document warning|Fixed → passes|I|bugs/reported-defects.*BUG-04|
REG-B05|REG|Prepare|Retest BUG-05 placeholder on canvas|Fixed → passes|I|bugs/reported-defects.*BUG-05|
REG-B06|REG|Prepare|Retest BUG-06 name-limit message|Fixed → passes|I|bugs/reported-defects.*BUG-06|
REG-B07|REG|Templates|Retest BUG-07 unique template names|Fixed → passes|I|bugs/reported-defects.*BUG-07|@data — not run on production pass.
REG-B08|REG|Workflow|Retest BUG-08 missing e-mail is blocking|Fixed → passes|I|bugs/reported-defects.*BUG-08|
REG-B09|REG|Workflow|Retest BUG-09 single recipient editor|Fixed → passes|I|bugs/reported-defects.*BUG-09|
REG-B10|REG|Templates|Retest BUG-10 template delete|Fixed → passes|I|bugs/reported-defects.*BUG-10|
REG-B11|REG|Support|Retest BUG-11 empty ticket feedback|Fixed → passes|I|ui/support.ui.spec.*BUG-11|
REG-B12|REG|Account|Retest BUG-12 "People1" heading|Fixed → passes|I|ui/account.ui.spec.*BUG-12|
REG-B13|REG|Public|Retest BUG-13 trust hero name|Fixed → passes|I|ui/public.ui.spec.*BUG-13|
REG-B14|REG|Billing|Retest BUG-14 plan pre-selection|Fixed → passes|I|ui/billing.ui.spec.*BUG-14|
REG-B15|REG|Auth|Retest BUG-15 registration error colour|Fixed → passes|I|ui/auth.ui.spec.*BUG-15|
REG-B16|REG|Platform|Retest BUG-16 hydration error|No hydration error|P|ui/.*meets the UI baseline|Intermittent; recorded as annotation, not failure. (Was observed on /developer/logs, removed 20 Nov 2026.)
REG-B17|REG|Contacts|Retest BUG-17 blank contact name|Fixed → passes|I|ui/contacts.ui.spec.*BUG-17|
REG-B25|REG|Billing|Retest BUG-25 upgrade charged the full month despite the prorated preview|Invoice equals the previewed prorated amount|M||No automated retest: an upgrade is charged once per billing period; compare invoice and preview at the next upgrade.
REG-B26|REG|Billing|Retest BUG-26 change-plan copy vs scheduled downgrade|Copy matches the behaviour|M||Manual retest while on a paid plan.
REG-B27|REG|Billing|Retest BUG-27 Recent charges ignores a paid invoice|Paid invoice listed under Recent charges|M||Manual retest.
REG-B28|REG|Reports|Retest BUG-28 WebKit report tabs after a period change|Fixed → passes on WebKit|I|reports/reports.spec.*BUG-28|New bug 18 Nov; runs cross-browser (@smoke).
REG-B29|REG|Documents|Retest BUG-29 Archive view offers Unarchive|Fixed → passes|I|flows/library-lifecycle.*BUG-29|New bug 20 Nov.
REG-B30|REG|Documents|Retest BUG-30 Trash offers Restore|Fixed → passes|I|flows/library-lifecycle.*BUG-30|New bug 20 Nov.
REG-B31|REG|Contacts|Retest BUG-31 Add as recipient names the envelope|Fixed → passes|I|contacts/add-as-recipient.*BUG-31|New bug 20 Nov.
REG-B32|REG|Documents|Retest BUG-32 duplicate folder names rejected|Fixed → passes|I|flows/library-lifecycle.*BUG-32|New bug 20 Nov.
REG-B33|REG|Overview|Retest BUG-33 volume chart weeks consecutive|Fixed → passes|I|overview/overview.spec.*BUG-33|New bug 20 Nov.
REG-B19|REG|Platform|Retest BUG-19 label-in-name on shell controls|Fixed → passes|I|a11y/accessibility.*BUG-19|New bug this cycle.
REG-B20|REG|Platform|Retest BUG-20 reflow at 320 px|Fixed → passes|I|a11y/accessibility.*BUG-20|New bug this cycle.
REG-B21|REG|Auth|Retest BUG-21 password meter labels|Fixed → passes|I|auth/auth-validation.*BUG-21|New bug this cycle.
REG-B22|REG|Transport|Retest BUG-22 server version disclosure|Fixed → passes|I|security/security.*BUG-22|New bug this cycle.
REG-B23|REG|Documents|Retest BUG-23 Drafts status filter|Fixed → passes|I|documents/library-search.*BUG-23|New bug this cycle.
REG-B24|REG|Performance|Retest BUG-24 cold page-load budgets|Fixed → passes|I|performance/performance.*PERF-00[12]|New bug this cycle.
SEC-001|SEC|Transport|HTTP redirects to HTTPS|30x to https|I|security/security.spec.*SEC-001|New.
SEC-002|SEC|Transport|Security headers (HSTS, CSP, XFO, nosniff, Referrer-Policy)|All present on /, /login, /overview|I|security/security.spec.*SEC-002|New.
SEC-003|SEC|Transport|No server version disclosure|No version in Server; no X-Powered-By|I|security/security.spec.*SEC-003|New. Fails: BUG-22.
SEC-004|SEC|Session|Session cookie HttpOnly, Secure, SameSite|Flags set; not in document.cookie|I|security/security.spec.*SEC-004|New.
SEC-005|SEC|API|Anonymous API access returns no data|30x/401, no JSON|I|security/security.spec.*SEC-005|New (6 endpoints).
SEC-006|SEC|Access|Guest deep links redirect (contacts, reports, support, billing, foreign doc)|/login?next=|I|security/security.spec.*SEC-006|New (5 routes).
SEC-007|SEC|Access|IDOR: unknown/foreign document unreadable (API + UI)|404/403; no actions|I|security/security.spec.*SEC-007|New.
SEC-008|SEC|Data|API payloads never include credentials/secrets|No password/hash/token fields|I|security/security.spec.*SEC-008|New.
SEC-009|SEC|Injection|Reflected XSS via document search query|Rendered as text|I|security/security.spec.*SEC-009|New.
SEC-010|SEC|Injection|XSS via global search input|Rendered as text|I|security/security.spec.*SEC-010|New.
SEC-011|SEC|Redirects|Open redirect via next= (signed in)|Stays on origin|I|security/security.spec.*SEC-011|New.
SEC-012|SEC|Redirects|next= not reflected as off-site link (guest)|No off-site link/script|I|security/security.spec.*SEC-012|New.
SEC-013|SEC|Auth|Login does not reveal account existence|Same message|I|security/security.spec.*SEC-013|New.
SEC-014|SEC|Auth|Password inputs masked with correct autocomplete|type=password; current/new-password|I|security/security.spec.*SEC-014|New.
SEC-015|SEC|Auth|Forgot-password does not reveal account existence|Neutral confirmation|I|security/security.spec.*SEC-015|New.
SEC-016|SEC|Injection|SQL/command meta-characters in login handled as data|No 5xx; stays on login|I|security/security.spec.*SEC-016|New.
SEC-017|SEC|API|HTTP TRACE refused|405/4xx; no echo|I|api/api-contract.*API-009|New.
SEC-018|SEC|Session|Session loss redirects with next= (NF-008)|/login?next=|I|security/session.spec.*SESS-001|New.
SEC-019|SEC|Session|Forged session cookie rejected|Redirect; API not 200|I|security/session.spec.*SESS-002|New.
SEC-020|SEC|Access|Role-based access (member vs admin)|Members cannot reach admin pages|B||Free plan has 1 seat — no second role to test with.
SEC-021|SEC|Auth|Brute-force / rate limiting on login|Lockout or throttling after N failures|B||Would lock the shared production account — needs a disposable account/staging.
SEC-022|SEC|Session|Concurrent session policy (single active session)|New sign-in supersedes old|P|flows/guest.flow.*UF-05|UF-05 signs in with the trusted device; supersession itself is observed (R17) but not asserted.
SEC-023|SEC|Data|No secrets in UI/logs/artifacts (NF-011)|Secret shown once; not in git|M||Needs a live API key; repo history contains the old password (TEST_PLAN §16.1).
SEC-024|SEC|App|Dependency / penetration test (OWASP ZAP, SCA)|No high findings|B||Out of scope without authorization; recommend ZAP baseline on staging.
SEC-025|SEC|Injection|Stored XSS in contact/folder names|Rendered as text|I|flows/contacts.flow.*SEC-025|Contact name with an onerror payload: shown as text on list and detail; no script, no <img>. Folder names not yet.
PERF-001|PERF|Public|Guest page load budgets (/, /login, /pricing)|TTFB ≤ 1.5 s, DCL ≤ 3 s, load ≤ 5 s|I|performance/performance.spec.*PERF-001|New (NF-012). Fails: BUG-24.
PERF-002|PERF|App|Signed-in page load budgets (5 modules)|Same budgets|I|performance/performance.spec.*PERF-002|New (NF-012). Fails: BUG-24.
PERF-003|PERF|API|API read latency p95 ≤ 1.5 s|5 samples per endpoint|I|performance/performance.spec.*PERF-003|New.
PERF-004|PERF|API|Concurrency smoke (10 parallel reads)|All 200; max ≤ 4 s|I|performance/performance.spec.*PERF-004|New. Not a load test.
PERF-005|PERF|API|Recovery after a burst|Median back within budget|P|performance/performance.spec.*PERF-005|Light burst only; true failure recovery needs staging.
PERF-006|PERF|Load|Load test at expected user traffic|SLA met at N users|B||Production only, no authorization for load; JMeter/k6 not installed. Needs staging.
PERF-007|PERF|Load|Peak / stress test|Degrades gracefully; no errors|B||Same as PERF-006.
PERF-008|PERF|Load|Soak test / resource usage (memory, CPU, DB)|No leaks over hours|B||No server metrics access.
PERF-009|PERF|Load|Bottleneck identification (APM, slow queries)|Top slow endpoints identified|B||No APM/server access; client-side timings only (PERF-003).
UX-001|UX|Public|Public pages UI baseline (h1, landmarks, names, no raw values, no JS errors)|Baseline passes|I|ui/public.ui.spec.*meets the UI baseline|
UX-002|UX|Auth|Auth pages UI baseline + error colour|Baseline; errors in error colour|I|ui/auth.ui.spec|
UX-003|UX|Shell|Application shell UI (skip link, aria-current, search focus)|Passes|I|ui/navigation.ui.spec|
UX-004|UX|App|Module pages UI baseline (all modules)|Baseline passes on every module route|I|ui/(overview¦documents¦contacts¦reports¦support¦account¦billing¦prepare¦workflow¦signer)\.ui\.spec.*meets the UI baseline|
UX-005|UX|App|Dark-scheme readability on every route|Heading contrast ≥ 3:1|I|ui/.*stays readable in dark mode|
UX-006|UX|App|Validation & error messages styled and worded as errors|Error colour + clear wording|I|ui/(auth¦workflow)\.ui\.spec.*(error colour¦inline error)|BUG-06/08/15 tracked separately.
A11Y-001|UX|Public|axe WCAG 2.1 AA — guest pages|No critical/serious violations|I|a11y/accessibility.*A11Y-001|New (5 pages). label-in-name tracked as BUG-19.
A11Y-002|UX|App|axe WCAG 2.1 AA — signed-in pages|No critical/serious violations|I|a11y/accessibility.*A11Y-002|New (9 pages). label-in-name tracked as BUG-19.
A11Y-003|UX|Auth|Logical keyboard Tab order on sign-in|E-mail → password → Continue|I|a11y/accessibility.*A11Y-003|New.
A11Y-004|UX|Auth|Visible keyboard focus|Outline or ring|I|a11y/accessibility.*A11Y-004|New (WCAG 2.4.7).
A11Y-005|UX|Auth|Page language and input purpose (autocomplete)|lang=en; autocomplete tokens|I|a11y/accessibility.*A11Y-005|New (WCAG 3.1.1, 1.3.5).
A11Y-006|UX|Auth|Reflow at 320 px (sign-in)|No horizontal scroll|I|a11y/accessibility.*A11Y-006|New (WCAG 1.4.10). Fails: BUG-20.
A11Y-007|UX|Contacts|Modal focus trap and focus return|Focus stays in dialog; returns to trigger|I|a11y/accessibility.*A11Y-007|New (WCAG 2.4.3).
A11Y-008|UX|Shell|Reflow at 320 px (app shell)|No horizontal scroll|I|a11y/accessibility.*A11Y-008|New. Fails: BUG-20.
A11Y-009|UX|App|Screen-reader pass (NVDA/VoiceOver) on core journeys|Announcements meaningful|M||Manual by definition.
A11Y-010|UX|Prepare|Keyboard-only field placement (NF-003, UF-49)|Field placed with Enter; focus visible|P|documents/prepare.spec.*places a signature field|Placement by keyboard asserted; focus visibility not.
A11Y-011|UX|App|Text resize 200 % / zoom|No loss of content|I|a11y/accessibility.spec.*A11Y-011|5 module pages at 200 % root font size: no horizontal scroll, heading not clipped.
UX-007|UX|App|Navigation & UX heuristic review|Consistent, discoverable|M||Expert review; findings logged as BUG-09/O-items.
COMP-001|COMP|App|Module pages at 360 / 768 / 1024 / 1920 px|No horizontal scroll; h1 visible|I|compatibility/viewports.*COMP-001|New (16 tests).
COMP-002|COMP|Shell|Navigation reachable at every viewport|Drawer/sidebar works|I|compatibility/viewports.*COMP-002|New.
COMP-003|COMP|Public|Landing and sign-in at every viewport|Fits|I|compatibility/viewports.*COMP-003|New.
COMP-004|COMP|App|Phone width 390 px on every route (NF-002)|No horizontal scroll|I|ui/.*fits a phone-width screen|
COMP-005|COMP|Browsers|Firefox smoke|Same as Chromium|I|@smoke|Computed from the firefox project run.
COMP-006|COMP|Browsers|WebKit (Safari engine) smoke|Same as Chromium|I|@smoke|Computed from the webkit project run.
COMP-007|COMP|Devices|Mobile Chrome (Pixel 7) smoke|Same as Chromium|I|@smoke|Computed from the mobile-chrome project run.
COMP-008|COMP|Browsers|Microsoft Edge / branded Chrome channels|Same as Chromium|I|@smoke|Opt-in project `edge` (channel msedge): npm run test:edge. Computed from the edge project run.
COMP-009|COMP|OS|macOS / Linux / Windows OS matrix|Same results on each OS|P||Windows (local) + Ubuntu (CI) only; macOS not available.
COMP-010|COMP|Devices|Real iOS/Android devices|Same results|B||Emulation only; needs a device cloud.
COMP-013|COMP|Reports|Report section navigation in WebKit after changing the period|Tabs navigate in every engine|I|reports/reports.spec.*BUG-28|New 18 Nov: fails on WebKit only (BUG-28).
COMP-011|COMP|Signer|Signer actions reachable below 1440 px (overflow menu)|Disclosure/Decline/Reassign in More actions|I|signer/signer.spec.*shows signing controls in preview-only mode|Found in cross-browser run: smoke assumed the 1440 px layout (automation defect, fixed).
COMP-012|COMP|Public|Phone header exposes Log in via the menu|Log in reachable on phones|I|public/public.spec.*landing page renders hero|Cross-browser run: test picked the hidden desktop link (automation defect, fixed).
NF-001|COMP|App|Desktop layout 1440×900|No overlap; tables scroll|I|ui/.*meets the UI baseline|Baseline asserts no horizontal overflow at 1440.
"""

COLUMNS = ["id", "category", "module", "scenario", "expected", "impl", "match", "remarks"]


def load():
    rows = []
    seen = set()
    for line in RAW.strip().splitlines():
        parts = line.split("|")
        if len(parts) != len(COLUMNS):
            raise ValueError(f"bad row ({len(parts)} cols): {line[:80]}")
        row = dict(zip(COLUMNS, (p.strip() for p in parts)))
        row["match"] = row["match"].replace("¦", "|")
        if row["id"] in seen:
            raise ValueError(f"duplicate scenario id {row['id']}")
        if row["category"] not in CATEGORIES or row["impl"] not in "IPNMB":
            raise ValueError(f"bad category/impl in {row['id']}")
        seen.add(row["id"])
        rows.append(row)
    return rows


if __name__ == "__main__":
    rows = load()
    from collections import Counter
    print(len(rows), "scenarios")
    print(Counter(r["category"] for r in rows))
    print(Counter(r["impl"] for r in rows))
