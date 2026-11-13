
| CON-010 | Group filter chips | P3 | Functional | Contacts in ≥2 groups | Click a group chip | Only that group listed; chip counts match rows | M |
| PREP-018 | Rename & autosave | P2 | Functional | Draft open | Rename document; place/move a field | Title updates in library; "N fields · autosaved" updates; survives reload | M |
| DOC-023 | Search documents | P1 | Functional | ≥2 documents | Type title / ENV id / recipient in **Search documents** | Matching rows only; count updates; empty state for no match | M |
| AUTH-024 | SSO notice on login | P3 | UI | Guest on `/login` | Inspect form | Enterprise IdP redirect notice and MFA note visible | M |# eSignPro — Test Cases (module-wise)

Legend — **P** priority (P0–P3), **Type** (Smoke, Functional, Negative, E2E, A11y, UI),
**Auto** = automated by a Playwright spec (`✔`) or manual/planned (`M`). Case IDs are
referenced by test names and bug reports.

Environment: `https://esignpro.net`, test workspace **Global Softel** (Free plan), saved
session `auth/storageState.json`. Sample upload: `tests/fixtures/sample-agreement.png`.

---

## 1. Authentication (`AUTH`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| AUTH-001 | Landing page renders | P1 | Smoke | Guest | Open `/` | Hero, CTA ("Start free"), Log in, pricing and footer visible; title contains eSignPro | ✔ `tests/public/public.spec.ts` |
| AUTH-002 | Navigate to registration | P1 | Functional | Guest on `/` | Click **Start free** in header | `/register` opens, heading "Create your workspace" | M |
| AUTH-003 | Registration form fields | P1 | Smoke | Guest on `/register` | Inspect form | Full name, Company, Work email, Password, Company type, Company size, Terms checkbox, Create account button all visible | ✔ `tests/auth/signup.spec.ts` |
| AUTH-004 | Empty registration submit | P1 | Negative | Guest on `/register` | Click **Create account** with empty form | Stays on `/register`; status message "Name and company are required" | ✔ |
| AUTH-005 | Password strength meter | P2 | Functional | Guest on `/register` | 1) Type `abc` 2) Type `Mokaddes@41` | Helper text stays "Use 12+ characters…" for weak input, changes to **Strong/Excellent** for the valid password | ✔ |
| AUTH-006 | Terms must be accepted | P0 | Negative | Filled registration form | Uncheck terms → **Create account** | Stays on `/register`; status "Accept the terms and disclosure" | ✔ |
| AUTH-007 | Company type/size options | P2 | Functional | Guest on `/register` | Open both selects | Type includes Other; sizes include 1–50, 51–500, 501–5,000, 5,000+; selection persists | ✔ (fill) / M |
| AUTH-008 | Successful signup → verify | P0 | E2E | Valid e-mail inbox | Submit valid form | Account created, routed to `/login/verify`, OTP e-mail arrives within 2 min | M (`RUN_SIGNUP=true`) |
| AUTH-009 | Verify with correct OTP | P0 | E2E | On `/login/verify` | Enter 6-digit code → Verify | Redirect to `/overview`; session cookie set | ✔ (manual OTP) |
| AUTH-010 | Verify with wrong OTP | P1 | Negative | On `/login/verify` | Enter `000000` → Verify | Inline error "invalid/incorrect"; stays on verify | M |
| AUTH-011 | Resend verification code | P2 | Functional | On `/login/verify` | Click **Resend** | Confirmation toast; new code e-mailed; previous code invalidated | M |
| AUTH-012 | Login with valid credentials | P0 | Smoke | Verified account | `/login` → email + password → **Continue** | Redirect to OTP (if required) then `/overview` dashboard | ✔ (invalid only) / M (valid needs OTP) |
| AUTH-013 | Login with wrong password | P0 | Negative | Guest on `/login` | Valid e-mail + wrong password → **Continue** | Stays on `/login`; error "invalid/incorrect/wrong"; no session | ✔ `tests/auth/login.spec.ts` |
| AUTH-014 | Empty login submit | P1 | Negative | Guest on `/login` | Click **Continue** with empty fields | Required/validation feedback; no navigation | ✔ `tests/auth/login.spec.ts` |
| AUTH-015 | Show/hide password | P2 | UI | Guest on `/login` | Click **Show password** | Password becomes readable, icon toggles, focus preserved | M |
| AUTH-016 | Remember this device | P2 | Functional | Guest on `/login` | Toggle the switch | Switch state toggles; OTP skipped on next login when enabled (within trust window) | M |
| AUTH-017 | Forgot password link | P2 | Functional | Guest on `/login` | Click **Forgot password?** | `/login/forgot` opens with e-mail field | ✔ `tests/public/public.spec.ts` (page) / M (e-mail) |
| AUTH-018 | Tab switch to Create account | P2 | Functional | Guest on `/login` | Click **Create account** tab | `/register` opens with the tab selected | ✔ |
| AUTH-019 | Sign out | P0 | Functional | Signed in | Account menu → **Sign out** | Session cleared; redirected to login/landing; back button cannot reopen app | M |
| AUTH-020 | Protected route redirect | P0 | Security | Guest (no session) | Open `/documents` | Redirected to `/login?next=…`; after login returned to intended page | ✔ `tests/public/public.spec.ts` |
| AUTH-021 | Public pages render | P2 | Smoke | Guest | Open `/pricing`, `/trust`, `/verify`, `/security`, `/legal`, `/changelog` | 200 and correct H1; every plan on pricing | ✔ `tests/public/public.spec.ts` |
| AUTH-022 | Verify a signed document | P1 | Functional | Completed envelope PDF | `/verify` → upload signed PDF | Hash matches; certificate details shown; tampered file rejected | M |
| AUTH-023 | Unknown route as guest | P3 | Functional | Guest | Open an unknown URL | Redirect to `/login?next=…` (404 only when signed in) | ✔ |

## 2. Navigation, search & theming (`NAV`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| NAV-001 | Sidebar exposes all modules | P1 | Smoke | Signed in | Open sidebar | Home, Documents, Contacts, Reports, Developer, Support, My account, Create, plan widget visible | ✔ |
| NAV-002 | Sidebar navigation works | P1 | Functional | Signed in on Overview | Click **Contacts** | `/contacts` loads; Contacts marked active | ✔ |
| NAV-003 | Account & help menu | P2 | Functional | Signed in | Click **Account and help** | Menu shows name, e-mail, workspace, admin role, My account, Notifications, Start product tour, Support centre, Contact support, Guides & docs, API console, Sign out | ✔ |
| NAV-004 | Global search shortcut | P2 | Functional | Signed in | Press `Ctrl/Cmd+K` | "Search your workspace" dialog opens, focused Search combobox, hint "Type at least 2 characters" | ✔ |
| NAV-005 | Global search results | P2 | Functional | Signed in, existing doc/contact | Open search → type ≥ 2 chars | Grouped results (documents, templates, contacts, members); Enter opens the item | ✔ `tests/navigation/navigation.spec.ts` |
| NAV-006 | Theme toggle | P3 | UI | Signed in | Click **Switch to dark theme** | Theme switches to dark, persists on reload/profile | M |
| NAV-007 | Collapsible sidebar | P3 | UI | Desktop ≥ 1280px | Click **Collapse sidebar** | Sidebar collapses to icon rail, content expands, preference persists | M |
| NAV-008 | Mobile drawer | P3 | Responsive | Pixel 7 viewport | Open navigation | Drawer overlays content, closes on backdrop/Escape, links usable | M |
| NAV-009 | Notifications popover | P3 | Functional | Signed in | Click the bell → See all notifications | Popover opens; link routes to `/notifications` | ✔ |
| NAV-010 | Product tour | P3 | Functional | Signed in | Take the tour → Skip | "Step 1 of N" dialog; Skip closes it | ✔ |

## 3. Overview dashboard (`OVR`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| OVR-001 | Dashboard loads | P1 | Smoke | Signed in | Open `/overview` | Heading "Overview", workspace summary and figures render | ✔ |
| OVR-002 | KPI cards | P1 | Functional | Signed in | Inspect summary | Action required, Out for signature, Envelopes, Seats activated, Completion rate present with values | ✔ |
| OVR-003 | Dashboard widgets | P2 | Functional | Signed in | Inspect body | Template strip, envelope volume chart, needs-attention list, spend, team activity visible | ✔ |
| OVR-004 | New envelope action | P0 | Functional | Signed in | Click **New envelope** | Routes to `/documents/prepare` with "New envelope" landing | ✔ |
| OVR-005 | Browse templates | P2 | Functional | Signed in | Click **Browse all templates** | `/documents?folder=templates` opens | ✔ |
| OVR-006 | Chart accessibility | P2 | A11y | Signed in | Focus the volume chart | Keyboard arrows read weeks; data table exposes week/envelope counts | M |
| OVR-007 | Plan renewal copy | P2 | Functional | Free plan | Inspect summary | "Free · renews <date>"; usage % matches plan widget | M |
| OVR-008 | Attention item navigation | P2 | Functional | Item present | Click an attention item | Opens the relevant page (billing/seats) | M |

## 4. Documents library (`DOC`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| DOC-001 | Library renders | P1 | Smoke | Signed in | Open `/documents` | Heading, search, toolbar, folders and views visible | ✔ |
| DOC-002 | Folder/view links | P1 | Functional | Signed in | Inspect sidebar | All documents, Templates, Archive, Trash, Waiting for me/others, Drafts, Completed, Expiring soon, Favourites, Shared with me, Owned by me | ✔ |
| DOC-003 | Filter dimensions | P1 | Functional | Signed in | Click **Filters** | Status, type, time (incl. custom), owner selects visible with expected options | ✔ |
| DOC-004 | Filter by status | P1 | Functional | ≥1 completed + 1 draft | Status → Completed | Only completed rows; count updates | M |
| DOC-005 | Filter by type/time/owner | P2 | Functional | Mixed data | Apply type, time range, owner | Result set narrows accordingly; filters combine | M |
| DOC-006 | Sort order | P2 | Functional | ≥2 documents | Sort by Name / Status / Owner | Rows reorder correctly; selection persists | ✔ (options) / M |
| DOC-007 | Create folder | P1 | Functional | Signed in | New folder → name → Create | Folder appears in sidebar/list; empty state shown | ✔ |
| DOC-008 | Folder name validation | P2 | Negative | New folder dialog | Submit blank or duplicate name | Inline error; folder not created | M |
| DOC-009 | Upload & prepare (file chooser) | P0 | E2E | Quota available | Upload PDF/image | Draft created, routed to `/documents/{id}/prepare` | ✔ (`@quota`, blocked while quota is 6/6) |
| DOC-010 | Upload unsupported file | P1 | Negative | Any | Choose `.exe`/oversized file | Rejected with clear error; no draft created | M |
| DOC-011 | Templates folder | P2 | Functional | Signed in | Open Templates | Templates view + **Browse form catalog**; empty state if none | ✔ |
| DOC-012 | Row content | P2 | Functional | Document exists | Inspect row | Title, `ENV-…`, page count, status, signer count, updated time, action visible | M |
| DOC-013 | Archive / Trash lifecycle | P2 | Functional | Document exists | Archive → open Archive → restore; Trash → restore/delete | Document moves between views; restore returns it; delete removes permanently | M |
| DOC-014 | Favourites / sharing views | P2 | Functional | Document exists | Favourite a document; share with team member | Appears under Favourites / Shared with me as appropriate | M |
| DOC-015 | Empty state | P3 | UI | Filter with no matches | Apply impossible filter combo | Friendly empty state with clear-filters action; no errors | M |
| DOC-016 | Pagination | P2 | Functional | > page-size documents | Navigate pages | Count "Showing X of Y"; page controls preserved with filters | M |
| DOC-017 | Row actions menu | P1 | Functional | Document exists | Open **More actions** | Open, Copy link, Add fields, Make template, Notarize, Download, Print, Move to folder, Duplicate, Rename, Archive, Delete | ✔ `tests/documents/library-actions.spec.ts` |
| DOC-018 | Row actions behaviour | P1 | Functional | Document exists | Duplicate, Rename, Move to folder, Download, Print | Each action applies and is reflected in list/audit | M |
| DOC-019 | Layout & bulk selection | P3 | UI | Signed in | Toggle List/Grid; Select all | Layout switches; selection count/bulk bar appears | ✔ (controls) / M |
| DOC-020 | Form catalog | P2 | Functional | Templates folder | Browse form catalog → search/category → add | Catalog dialog; adding copies form into Templates | ✔ (dialog) / M (add) |
| DOC-021 | Unknown document id | P2 | Negative | Signed in | Open `/documents/<random-uuid>/prepare` | "This document isn't available" + Go to documents; no data leak | ✔ |
| DOC-022 | Quota exhausted | P0 | Negative | 6/6 requests used | Upload a new document | Upload refused (HTTP 402) with upgrade guidance; no draft created | M |

## 5. Envelope preparation (`PREP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| PREP-001 | New envelope landing | P1 | Smoke | Signed in | Open `/documents/prepare` | Heading, Choose a file, Start from a template, 3-step explainer visible | ✔ |
| PREP-002 | Upload opens builder | P0 | E2E | Quota | Choose file | Draft created, builder opens with document rendered | ✔ (`@quota`, blocked while quota is 6/6) |
| PREP-003 | Recipients panel | P0 | Functional | Draft open | Inspect panel | Add recipient + Manage recipients available; recipient 1 status "Pending / Needs to sign" | ✔ |
| PREP-004 | Add recipient & roles | P1 | Functional | Draft open | Add recipient → set name/email/role | Recipient appears with role (signer/approver/CC/in-person) and field count 0 | M |
| PREP-005 | Manage recipients | P1 | Functional | ≥1 recipient | Manage recipients → rename, reorder, remove | Changes persist after save/reload | ✔ (dialog inventory) / M (persist) |
| PREP-006 | Field palette inventory | P1 | Functional | Draft open | Inspect palette + search/favourites | Signature, Initials, Date and Time, Date Signed, Full Name, Email, Text Input, Checkbox, Radio Group, Dropdown, Stamp, Attachment, Number, Text Box, Pen, Payment | ✔ (subset) / M |
| PREP-007 | Place signature field | P0 | Functional | Draft open | Focus Signature → Enter (or drag) | Field placed, count increments, autosave indicator updates | ✔ |
| PREP-008 | Assign field to recipient | P1 | Functional | Field + 2 recipients | Place field, select recipient in inspector | Field bound to that recipient; recipient field count updates | M |
| PREP-009 | Validation/required rules | P1 | Functional | Text/number field placed | Set required, min/max, pattern, help text | Inspector persists rules; preview enforces them | ✔ (rule options) / M (enforcement) |
| PREP-010 | Conditional logic | P2 | Functional | Two fields | Configure show/hide dependency | Preview shows/hides dependent field correctly | ✔ (operators) / M (behaviour) |
| PREP-011 | Pages panel | P2 | Functional | Multi-page PDF | Add/insert/reorder/delete page | Thumbnails and pagination update; fields remain attached correctly | ✔ (controls) / M |
| PREP-012 | Inspector tools | P2 | Functional | Field placed | Duplicate, copy to every page, align, snap, zoom, undo/redo | Each action applies and can be undone; autosave persists | ✔ (controls) / M |
| PREP-013 | Download PDF / save as template | P2 | Functional | Draft open | Download PDF; Save as template | PDF downloads with fields; template appears in Templates folder | ✔ (controls) / M |
| PREP-014 | Preview signer view | P1 | Functional | Draft with fields | Click **Preview** | Signer-view opens in preview mode with the placed fields | M |
| PREP-015 | Save and close | P1 | Functional | Draft modified | Save and close | Returns to Documents; draft listed with correct status | M |
| PREP-016 | Canvas toolbar & pages panel | P2 | Functional | Draft open | Inspect toolbar | Undo/Redo, zoom, fit, snap, align, distribute, duplicate, find fields, Add page present | ✔ `tests/documents/builder-details.spec.ts` |
| PREP-017 | Add recipient from contacts | P2 | Functional | Contact exists | Manage recipients → Add from contacts | Picker lists contacts; chosen contact prefills e-mail/role | M |

## 6. Signing workflow (`WF`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| WF-001 | Workflow page loads | P1 | Smoke | Draft with recipient | Click **2 Workflow** | "Workflow & routing" with all sections | ✔ |
| WF-002 | Sequential vs parallel | P1 | Functional | ≥2 recipients | Toggle routing modes | Mode persists; order controls reflect the choice | ✔ (visibility) / M |
| WF-003 | Invite preview | P2 | Functional | Recipient present | Edit subject/message | Preview updates live; merge tokens resolve to recipient/document values | ✔ (section) / M |
| WF-004 | Payment request | P2 | Functional | Stripe connected | Enable payment, choose single/split/custom, save | Payment request saved; requires a placed payment field | ✔ (blocked without Stripe) / M |
| WF-005 | Before-you-send checklist | P1 | Functional | Incomplete envelope | Inspect checklist | Each pending item (e-mail, fields, disclosure, certificate) flagged with deep link | ✔ (section) / M |
| WF-006 | Reminders & expiration | P1 | Functional | Workflow open | Choose 24h/48h/7d/none + expiry | Selection persists after save/reload | ✔ (options) / M (persist) |
| WF-007 | Branding theme | P2 | Functional | Theme exists | Select theme | Invite preview reflects logo/colours | ✔ (section) / M |
| WF-008 | Delivery simulation | P2 | Functional | Workflow open | Open simulation | Shows recipient delivery experience without sending | ✔ (section) / M |
| WF-009 | Send blocked without recipient/fields | P0 | Negative | Draft without recipient | Send envelope | Blocked with actionable errors; nothing sent; quota unchanged | M |
| WF-010 | Send envelope golden path | P0 | E2E | Recipient with real mailbox, quota | Complete checklist → Send | Status Waiting for others; recipient receives invite; audit entries created | M |

## 7. Signer experience (`SIGN`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| SIGN-001 | Preview modes | P2 | Functional | Signer view open | Toggle Desktop / Mobile | Layout switches; fields remain readable/usable | ✔ `tests/signer/signer.spec.ts` |
| SIGN-002 | Start signing & fields | P1 | Functional | Sent envelope (manual) | Start signing → complete fields | Required fields enforced; progress updates | ✔ (controls, progress) / M |
| SIGN-003 | Disclosure consent | P0 | Functional | Signing session | Open Disclosure | E-records disclosure shown; consent required before finish | M |
| SIGN-004 | Decline flow | P1 | Functional | Signing session | Decline + reason | Envelope marked declined; sender notified; audit entry | M |
| SIGN-005 | Reassign | P2 | Functional | Signing session | Reassign to another e-mail | New recipient receives invite; original cannot sign | M |
| SIGN-006 | Finish & certificate | P0 | E2E | All fields filled | Finish | Completion page; signed PDF/certificate downloadable; hash-chained audit intact | M |
| SIGN-007 | Back to editing | P3 | Functional | Signer preview | Click **Back to editing** | Returns to the builder for the same document | ✔ |

## 8. Contacts (`CON`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| CON-001 | Address book renders | P1 | Smoke | Signed in | Open `/contacts` | Heading, address book + columns Contact/Company/Group/Source/Last signed/Envelopes | ✔ |
| CON-002 | New contact dialog | P1 | Functional | `/contacts` | Click **New contact** | Fields: Full name, Company, Email, Job title, Default role, Group; Cancel/Save | ✔ |
| CON-003 | Role & group options | P2 | Functional | Dialog open | Inspect selects | Roles: Needs to sign, Approver, Receives a copy, In-person signer; Groups: Customers, Internal, Counsel, Vendors | ✔ |
| CON-004 | Create contact | P1 | Functional | Dialog open | Fill valid values → Save | Contact saved; detail page opens with details + activity; row appears in list | ✔ |
| CON-005 | Required/format validation | P1 | Negative | Dialog open | Save blank / invalid e-mail / duplicate e-mail | Inline errors; dialog stays; nothing saved | ✔ (invalid e-mail) / M (blank, duplicate) |
| CON-006 | Contact detail tabs | P2 | Functional | Contact exists | Open contact | Documents and Contact details tabs; Edit contact, Send envelope, Add as recipient | ✔ (detail load) / M |
| CON-007 | Edit contact | P2 | Functional | Contact exists | Edit → change job title/group → Save | Values persist; audit/contact source unchanged | M |
| CON-008 | Add as recipient | P2 | Functional | Contact + draft | Add as recipient | Recipient prefilled with contact details/role | M |
| CON-009 | Search contacts | P2 | Functional | ≥2 contacts | Search by name/e-mail/company | Matching rows only; empty state for no match | M |

## 9. Reports & analytics (`REP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| REP-001 | Reports dashboard | P1 | Smoke | Signed in | Open `/reports` | Heading, My Analytics, date range, Export report | ✔ |
| REP-002 | Date ranges | P1 | Functional | Reports open | Select 7/30/quarter/12 months | Metrics and tables reload for the period; selection sticks | ✔ |
| REP-003 | Report sections | P2 | Functional | Reports open | Inspect section list | My analytics, All reports, By document, By template, By recipient, Custom report | ✔ |
| REP-004 | Recipient report | P1 | Functional | Reports open | Click **By recipient** | `?section=recipients`; table Recipient/Created/Sent/Pending/Completed/Cancelled/Declined/Rate | ✔ |
| REP-005 | Document/template reports | P2 | Functional | Reports open | Open By document / By template | Per-document/template metrics with totals | ✔ `tests/reports/report-sections.spec.ts` |
| REP-006 | Custom report builder | P2 | Functional | Reports open | Open Custom report → choose dimensions | Filter builder works; preview/export available | ✔ (add dimension) / M (run/export) |
| REP-007 | Export report | P2 | Functional | Reports open | Click **Export report** | Download starts with selected range/section; file is valid | M |
| REP-008 | Empty period | P3 | UI | No activity in range | Select range with no data | Zeroed metrics and clear empty state (no NaN/errors) | M |
| REP-009 | All reports catalogue | P2 | Functional | Reports open | Open **All reports** | 6 CSV reports listed (documents, templates, template usage, completed copies, recipients, audit) | ✔ |
| REP-010 | Report data accuracy | P1 | Functional | Mixed sent/draft data | Compare scorecards with library | Drafts are not counted as sent invites; statuses match the library (FEATURES O3, O5) | M |

## 10. Developer platform (`DEV`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| DEV-001 | Developer overview | P2 | Smoke | Signed in | Open `/developer/api` | Heading, add-on summary, usage metrics | ✔ |
| DEV-002 | Usage metrics | P2 | Functional | Developer page | Inspect metrics | Requests/24h, p95, error rate, active keys, embed sessions show numbers | ✔ |
| DEV-003 | Section navigation | P2 | Functional | Developer page | Open API keys / Webhooks | URL `?section=…`; correct panel renders | ✔ |
| DEV-004 | API keys empty state | P2 | Functional | No keys | Open API keys | "No API keys yet" + Create key | ✔ (keys panel, data-independent) |
| DEV-005 | Create API key | P1 | Functional | API keys page | Create key → name/scopes → confirm | Secret shown once; key listed with scopes; copy works | M |
| DEV-006 | Roll/revoke key | P1 | Security | Key exists | Roll then revoke | Old secret invalid immediately; revoked key cannot call API | M |
| DEV-007 | Scopes inventory | P2 | Functional | API keys page | Inspect scopes | users:read, contacts:read/write, documents:read/write, envelopes:send, audit:read, partner:manage | ✔ |
| DEV-008 | API console | P2 | Functional | Developer page | Open API console → compose call → Send request | Request executed against workspace; response/status/headers shown | ✔ (UI) / M (call) |
| DEV-009 | Guides & docs | P2 | Functional | Developer page | Open Guides | Quickstart, reference, embedding, webhooks, partner, migration docs | ✔ |
| DEV-010 | Activity logs / webhooks | P2 | Functional | Developer page | Open Activity logs and Webhooks | Log rows/filters; webhook signature + retry guidance | ✔ `tests/developer/developer-tools.spec.ts` |
| DEV-011 | Partner page | P2 | Functional | Developer page | Open Become a partner | Partner/reseller provisioning info and CTA | ✔ (form) / M (submit) |
| DEV-012 | Endpoints reference | P2 | Functional | Developer page | Open Endpoints | Workspace/Documents/Embedding groups; route, parameters, example response | ✔ |
| DEV-013 | Plan usage meters | P2 | Functional | Developer page | Open Plan usage | Signature requests, API calls, storage, SMS with used/allowance | ✔ |
| DEV-014 | Webhook endpoint validation | P2 | Negative | Webhooks | Add endpoint with empty/invalid URL | Create endpoint disabled; valid https URL enables it | ✔ (empty) / M |
| DEV-015 | Embed snippet settings | P2 | Functional | API keys | Edit Allowed origins / Return URL, blur | Values persist after reload; snippet updates | M |
| DEV-016 | Create key has no confirmation | P2 | Security | API keys | Click Create key | Product decision needed: key is created instantly (FEATURES O10) | M |

## 11. Support (`SUP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| SUP-001 | Support dashboard | P1 | Smoke | Signed in | Open `/support` | Counters (All/Open/Escalated/Pending/Resolved/Breached/Unassigned/P1 open), New ticket, filters | ✔ |
| SUP-002 | New ticket dialog | P1 | Functional | Support page | Click **New ticket** | Subject, Category (5), Priority (P1–P4), Related envelope, Description, Submit | ✔ |
| SUP-003 | Priority/category inventory | P2 | Functional | Dialog open | Inspect selects | Categories and P1–P4 labels exactly as documented | ✔ |
| SUP-004 | Empty ticket submit | P1 | Negative | Dialog open | Submit without required fields | Validation errors; dialog stays; no ticket created | ✔ (no write request) — see FEATURES O9 |
| SUP-005 | Create ticket + SLA | P1 | Functional | Dialog open | Submit valid P2 ticket | Ticket listed under Open with SLA; counters increment | M |
| SUP-006 | Filters/sort | P2 | Functional | ≥2 tickets | Filter status/priority, sort by SLA risk | List and counters reflect filters; sort stable | ✔ (controls) / M (with data) |
| SUP-007 | Queue controls | P2 | Functional | Support page | Inspect search, sort, Export CSV, status/attention chips, pagination | All present with expected options | ✔ `tests/support/support-queue.spec.ts` |
| SUP-008 | Default priority | P3 | Functional | New ticket | Open dialog | Priority defaults to P3 · Normal | ✔ |

## 12. Account, security & settings (`ACC`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| ACC-001 | Profile loads | P1 | Smoke | Signed in | Open `/account/profile` | Name, verified e-mail, time zone, language, photo, Save disabled | ✔ |
| ACC-002 | Profile values | P1 | Functional | Signed in | Inspect fields | Name `Mokaddes SQA`, e-mail matches account, "Email verified <date>" | ✔ |
| ACC-003 | Edit profile | P1 | Functional | Profile | Change time zone/language → Save | Save enables; values persist; toast/status confirms | M |
| ACC-004 | Appearance control | P2 | Functional | Profile | Select Match system/Light/Dark | Radiogroup switches theme immediately; persists per account | ✔ (control) / M |
| ACC-005 | Signature dialog | P1 | Functional | Profile | Click **Add signature** | Dialog with Draw/Type/Upload tabs, ink colours, stroke slider, Clear, Adopt | ✔ |
| ACC-006 | Adopt signature | P1 | Functional | Signature dialog | Draw/type → Adopt | Signature saved as default; shown in Signatures list; offered when signing | M |
| ACC-007 | Change password | P0 | Functional | Profile | Change password with valid current → new | Re-auth enforced; old password rejected afterwards; sessions handled | M |
| ACC-008 | Change password validation | P1 | Negative | Change password dialog | Wrong current / weak new / mismatch | Inline errors; password unchanged | ✔ (empty current password) / M |
| ACC-009 | Login & security controls | P1 | Functional | Signed in | Open `/account/security` | 2FA, Passkeys, SSO SAML, authenticated devices sections | ✔ |
| ACC-010 | Enable 2FA / add passkey | P1 | Functional | Security page | Connect 2FA; Add passkey | Setup flow completes/offers recovery; device registered | M |
| ACC-011 | Device session control | P1 | Security | Multiple sessions | Forget a device; Forget all | Session revoked; user signed out on that device | M |
| ACC-012 | Notification preferences | P2 | Functional | Signed in | Open `/account/notifications` | All 8 event preferences listed; toggles persist | ✔ |
| ACC-013 | Integrations | P2 | Functional | Signed in | Open `/account/integrations` | Catalogue + connect flow renders with statuses | ✔ `tests/account/settings.spec.ts` |
| ACC-014 | Organization & teams | P2 | Functional | Signed in | Open `/account/organization` | Members, roles, invites, seats; admin can invite/remove | ✔ (page, invite validation) / M (invite) |
| ACC-015 | Audit trail | P1 | Functional | Signed in | Open `/account/audit` | Table Event/User/Details/Document/IP/Time; filters + pagination; empty state text | ✔ `tests/account/settings.spec.ts` |
| ACC-016 | Payments & branding | P2 | Functional | Signed in | Open `/account/payments`, `/account/brand` | Payment methods/receipts; theme editor with preview | ✔ `tests/account/settings.spec.ts` |
| ACC-017 | Notifications centre | P2 | Functional | Signed in | Open `/notifications` | List, read state, filters, mark read | ✔ `tests/account/settings.spec.ts` |
| ACC-018 | Deep link as guest | P0 | Security | Guest | Open `/account/security` | Redirect to `/login?next=…`; no data leaked | ✔ `tests/public/public.spec.ts` |
| ACC-019 | Remembered browsers | P1 | Security | Signed in | Forget one; Forget all | Remembered browser removed; OTP required on next login there | ✔ (controls) / M |
| ACC-020 | Organization field palette | P2 | Functional | Admin | Untick a field type → Save palette | Builder palette no longer offers it; re-enable restores | ✔ (16 types) / M |
| ACC-021 | Invite member validation | P2 | Negative | Admin | Invite member with empty e-mail | Next disabled; nothing sent | ✔ |
| ACC-022 | Branding plan gate | P2 | Functional | Free plan | Open `/account/brand` | "Not included in the Free plan" + View plans; no theme can be added | ✔ |
| ACC-023 | Stripe Connect for payments | P2 | Functional | Admin | Payments → choose business type → Connect Stripe | Redirects to Stripe onboarding; status returns connected | M |

## 13. Billing & plan (`BIL`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| BIL-001 | Billing page | P1 | Smoke | Signed in | Open `/account/billing` | Plan card (Free), renewal, usage, billing e-mail, invoices table | ✔ |
| BIL-002 | Plan catalogue | P1 | Functional | Billing | Open **Change plan** | Free $0, Team $12/seat, Business $28/seat, Enterprise $499 | ✔ |
| BIL-003 | Seats dialog | P1 | Functional | Billing | Open **Add seats** | Seats input, prorated-today and next-invoice preview, confirm | ✔ |
| BIL-004 | Payment method | P1 | Functional | Billing | Click **Add payment method** | Card form (Stripe) opens; validation for number/expiry/CVC; cancel safe | ✔ (dialog) / `@payment` (card entry) |
| BIL-005 | No payment method state | P2 | Functional | Free plan | Inspect billing | "No payment method on file"; invoices empty state | ✔ |
| BIL-006 | Enterprise trial | P2 | Functional | Billing | Open plan → Start 30-day free trial | Trial terms shown; no charge until end; plan updates only on confirm | M |
| BIL-007 | Change plan guard | P0 | Functional | No card | Select paid plan → Switch plan | Prompts for payment method; plan and charge are not applied silently | M |
| BIL-008 | Invoices | P2 | Functional | Billing | Click All invoices & receipts | Full invoice list with download; pagination | M |
| BIL-009 | Billing details save on blur | P2 | Functional | Billing | Edit billing e-mail / Tax ID / cycle, blur | Saved without a button; persists on reload | M |
| BIL-010 | Invoice / PO payment option | P3 | Functional | Billing | Add payment method → Invoice / PO | Invoice billing form shown; no card required | M |
| BIL-011 | Billing API outage | P2 | Negative | Backend slow | Load billing while API times out | "Can't reach the eSignPro API" + Retry; no misleading plan data (FEATURES O1) | M |

## 14. Non-functional & cross-cutting (`NF`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| NF-001 | Desktop layout 1440×900 | P1 | UI | Chromium | Browse every module | No overlap/truncation; sidebar persistent; tables scroll horizontally if needed | ✔ (implicit) |
| NF-002 | Mobile layout (Pixel 7) | P2 | Responsive | Mobile project | Browse documents, prepare, signer preview | Drawer nav, single-column cards, usable tap targets | M |
| NF-003 | Keyboard-only field placement | P2 | A11y | Builder open | Tab to field, press Enter | Field places without mouse; focus visible throughout | M |
| NF-004 | Accessible names/landmarks | P2 | A11y | Any page | Inspect roles | One h1, named regions/nav, labelled inputs, skip link works | M |
| NF-005 | Cross-browser | P2 | Compatibility | Firefox/WebKit projects | Run `@smoke` | Same results as Chromium; no console errors | ✔ (projects) |
| NF-006 | Console health | P2 | Functional | Any module | Collect console messages | No uncaught exceptions; no failed API calls on happy path | M |
| NF-007 | 404 route | P2 | Functional | Signed in | Open `/documents/<unknown-id>` | "That page isn't here" with Back to overview / Open documents | ✔ `tests/navigation/navigation.spec.ts` |
| NF-008 | Session expiry | P1 | Security | Expired/removed session | Open protected route | Redirect to login with `next`; after re-auth return to route | M |
| NF-009 | XSS/injection smoke | P1 | Security | Any free-text field | Enter `<script>alert(1)</script>` in contact/subject/folder | Rendered as text; no script execution | M |
| NF-010 | Error/offline state | P3 | Negative | Offline | Trigger action | Friendly error/toast; no data corruption; retry works | M |
| NF-011 | No secrets in UI/logs | P0 | Security | API key flow | Create key then inspect reports/logs | Secret shown once only; not present in artifacts committed to git | M |
| NF-012 | Performance smoke | P3 | Performance | Cold load | Load each module | Interactive under ~3 s on broadband; no long blocking alerts | M |

---

## Feature → test-case traceability

| Feature IDs (FEATURES.md) | Test cases |
|---------------------------|-----------|
| PUB-01 · PUB-02 · PUB-03 · PUB-13 · PUB-14 | AUTH-001, AUTH-021, AUTH-022 |
| PUB-04 · PUB-05 · PUB-08 · PUB-09 | AUTH-012…AUTH-018, AUTH-024 |
| PUB-06 · PUB-07 | AUTH-002…AUTH-011 |
| PUB-10 | NF-007, AUTH-023 |
| PUB-11 · PUB-12 | NAV-006…NAV-008, NF-002 |
| SHELL-01…SHELL-06 | NAV-001…NAV-005, NAV-009, NAV-010 |
| SHELL-07 · SHELL-08 | NF-003, NF-004 |
| SHELL-09 | BIL-011, NF-010 |
| OVR-01…OVR-08 | OVR-001…OVR-008 |
| DOC-01…DOC-14, §4.1 folders/views | DOC-001…DOC-023 |
| §5.1 New envelope, PREP-01…PREP-10 | PREP-001…PREP-018 |
| WF-01…WF-09 | WF-001…WF-010 |
| SIGN-01…SIGN-06 | SIGN-001…SIGN-007, ACC-006 |
| CON-01…CON-07 | CON-001…CON-010 |
| REP-01…REP-09 | REP-001…REP-010 |
| DEV-01…DEV-11 | DEV-001…DEV-016 |
| SUP-01…SUP-06 | SUP-001…SUP-008 |
| §12.1 Profile | ACC-001…ACC-008 |
| §12.2 Security | ACC-009…ACC-011, ACC-019 |
| §12.3 Notification prefs · §12.10 centre | ACC-012, ACC-017 |
| §12.4…§12.8 Integrations, Organization, Audit, Payments, Branding | ACC-013…ACC-016, ACC-020…ACC-023 |
| §12.9 Billing | BIL-001…BIL-011 |
| §13 Cross-cutting | NF-001…NF-012 |
| §14 Observations O1…O11 | BIL-011, ACC-014, REP-010, SUP-004, DEV-016, AUTH-023 (defect retests) |

---

## Coverage summary

| Module | Cases | Automated | Partly automated | Manual/planned |
|--------|------:|----------:|-----------------:|---------------:|
| Auth | 24 | 12 | 3 | 9 |
| Navigation | 10 | 7 | 0 | 3 |
| Overview | 8 | 5 | 0 | 3 |
| Documents | 23 | 8 | 3 | 12 |
| Prepare | 18 | 5 | 7 | 6 |
| Workflow | 10 | 1 | 7 | 2 |
| Signer | 7 | 2 | 1 | 4 |
| Contacts | 10 | 4 | 2 | 4 |
| Reports | 10 | 6 | 1 | 3 |
| Developer | 16 | 9 | 3 | 4 |
| Support | 8 | 6 | 1 | 1 |
| Account | 23 | 12 | 5 | 6 |
| Billing | 11 | 5 | 0 | 6 |
| Non-functional | 12 | 3 | 0 | 9 |
| **Total** | **190** | **85** | **33** | **72** |

"Partly automated" means the UI/controls are asserted automatically while the behaviour
(persisting, sending, e-mail) is still verified manually.

Every feature ID in [`FEATURES.md`](./FEATURES.md) maps to at least one case above.
Automated cases live in `tests/**` and run on every push (`@smoke`) or nightly (full).
Manual cases are executed per the phases in [`TEST_PLAN.md`](./TEST_PLAN.md).
