# eSignPro — Test Cases (module-wise)

Legend — **P** priority (P0–P3), **Type** (Smoke, Functional, Negative, E2E, A11y, UI),
**Auto** = automated by a Playwright spec (`✔`) or manual/planned (`M`). Case IDs are
referenced by test names and bug reports. End-to-end journeys that chain these cases are in
[`USER_FLOWS.md`](./USER_FLOWS.md) (`UF-xx`); defects with a reproduction test are in §15.

Environment: `https://esignpro.net`, test workspace **Global Softel** (Free plan), saved
session `auth/storageState.json`. Sample upload: `tests/fixtures/sample-agreement.png`.

---

## 1. Authentication (`AUTH`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| AUTH-001 | Landing page renders | P1 | Smoke | Guest | Open `/` | Hero, CTA ("Start free"), Log in, pricing and footer visible; title contains eSignPro | ✔ `tests/public/public.spec.ts` |
| AUTH-002 | Navigate to registration | P1 | Functional | Guest on `/` | Click **Start free** in header | `/register` opens, heading "Create your workspace" | ✔ `tests/flows/guest.flow.spec.ts` (via pricing) |
| AUTH-003 | Registration form fields | P1 | Smoke | Guest on `/register` | Inspect form | Full name, Company, Work email, Password, Company type, Company size, Terms checkbox, Create account button all visible | ✔ `tests/auth/signup.spec.ts` |
| AUTH-004 | Empty registration submit | P1 | Negative | Guest on `/register` | Click **Create account** with empty form | Stays on `/register`; status message "Name and company are required" | ✔ |
| AUTH-005 | Password strength meter | P2 | Functional | Guest on `/register` | 1) Type `abc` 2) Type `Str0ng!Example#2026` | Helper text stays "Use 12+ characters…" for weak input, changes to **Strong/Excellent** for the valid password | ✔ |
| AUTH-006 | Terms must be accepted | P0 | Negative | Filled registration form | Uncheck terms → **Create account** | Stays on `/register`; status "Accept the terms and disclosure" | ✔ |
| AUTH-007 | Company type/size options | P2 | Functional | Guest on `/register` | Open both selects | Type includes Other; sizes include 1–50, 51–500, 501–5,000, 5,000+; selection persists | ✔ (fill) / M |
| AUTH-008 | Successful signup → verify | P0 | E2E | Valid e-mail inbox | Submit valid form | Account created, routed to `/login/verify`, OTP e-mail arrives within 2 min | M (`RUN_SIGNUP=true`) |
| AUTH-009 | Verify with correct OTP | P0 | E2E | On `/login/verify` | Enter 6-digit code → Verify | Redirect to `/overview`; session cookie set | ✔ (manual OTP) |
| AUTH-010 | Verify with wrong OTP | P1 | Negative | On `/login/verify` | Enter `000000` → Verify | Inline error "invalid/incorrect"; stays on verify | M |
| AUTH-011 | Resend verification code | P2 | Functional | On `/login/verify` | Click **Resend** | Confirmation toast; new code e-mailed; previous code invalidated | M |
| AUTH-012 | Login with valid credentials | P0 | Smoke | Verified account | `/login` → email + password → **Continue** | Redirect to OTP (if required) then `/overview` dashboard | ✔ (invalid only) / M (valid needs OTP) |
| AUTH-013 | Login with wrong password | P0 | Negative | Guest on `/login` | Valid e-mail + wrong password → **Continue** | Stays on `/login`; error "invalid/incorrect/wrong"; no session | ✔ `tests/auth/login.spec.ts` |
| AUTH-014 | Empty login submit | P1 | Negative | Guest on `/login` | Click **Continue** with empty fields | Required/validation feedback; no navigation | ✔ `tests/auth/login.spec.ts` |
| AUTH-015 | Show/hide password | P2 | UI | Guest on `/login` | Click **Show password** | Password becomes readable, icon toggles, focus preserved | ✔ `tests/ui/auth.ui.spec.ts` |
| AUTH-016 | Remember this device | P2 | Functional | Guest on `/login` | Toggle the switch | Switch state toggles; OTP skipped on next login when enabled (within trust window) | M |
| AUTH-017 | Forgot password link | P2 | Functional | Guest on `/login` | Click **Forgot password?** | `/login/forgot` opens with e-mail field | ✔ `tests/public/public.spec.ts` (page) / M (e-mail) |
| AUTH-018 | Tab switch to Create account | P2 | Functional | Guest on `/login` | Click **Create account** tab | `/register` opens with the tab selected | ✔ |
| AUTH-019 | Sign out | P0 | Functional | Signed in | Account menu → **Sign out** | Session cleared; redirected to login/landing; back button cannot reopen app | M |
| AUTH-020 | Protected route redirect | P0 | Security | Guest (no session) | Open `/documents` | Redirected to `/login?next=…`; after login returned to intended page | ✔ `tests/public/public.spec.ts` |
| AUTH-021 | Public pages render | P2 | Smoke | Guest | Open `/pricing`, `/trust`, `/verify`, `/security`, `/legal`, `/changelog` | 200 and correct H1; every plan on pricing | ✔ `tests/public/public.spec.ts`, `tests/ui/public.ui.spec.ts` (**BUG-13**) |
| AUTH-022 | Verify a signed document | P1 | Functional | Completed envelope PDF | `/verify` → upload signed PDF | Hash matches; certificate details shown; tampered file rejected | M |
| AUTH-023 | Unknown route as guest | P3 | Functional | Guest | Open an unknown URL | Redirect to `/login?next=…` (404 only when signed in) | ✔ |
| AUTH-024 | SSO notice on login | P3 | UI | Guest on `/login` | Inspect form | Enterprise IdP redirect notice and MFA note visible | M |

## 2. Navigation, search & theming (`NAV`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| NAV-001 | Sidebar exposes all modules | P1 | Smoke | Signed in | Open sidebar | Home, Documents, Contacts, Reports, Support, My account, Create, plan widget visible | ✔ |
| NAV-002 | Sidebar navigation works | P1 | Functional | Signed in on Overview | Click **Contacts** | `/contacts` loads; Contacts marked active | ✔ |
| NAV-003 | Account & help menu | P2 | Functional | Signed in | Click **Account and help** | Menu shows name, e-mail, workspace, admin role, My account, Notifications, Start product tour, Support centre, Contact support, Guides & docs, API console, Sign out | ✔ |
| NAV-004 | Global search shortcut | P2 | Functional | Signed in | Press `Ctrl/Cmd+K` | "Search your workspace" dialog opens, focused Search combobox, hint "Type at least 2 characters" | ✔ |
| NAV-005 | Global search results | P2 | Functional | Signed in, existing doc/contact | Open search → type ≥ 2 chars | Grouped results (documents, templates, contacts, members); Enter opens the item | ✔ `tests/navigation/navigation.spec.ts` |
| NAV-006 | Theme toggle | P3 | UI | Signed in | Click **Switch to dark theme** | Theme switches to dark, persists on reload/profile | ✔ (toggle) `tests/ui/navigation.ui.spec.ts` / M (persist) |
| NAV-007 | Collapsible sidebar | P3 | UI | Desktop ≥ 1280px | Click **Collapse sidebar** | Sidebar collapses to icon rail, content expands, preference persists | ✔ `tests/ui/navigation.ui.spec.ts` |
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
| DOC-017 | Row actions menu | P1 | Functional | Document exists | Open **More actions** | Open, Copy link, Add fields, Make template, ~~Notarize~~ (removed 20 Nov 2026), Notarize, Download, Print, Move to folder, Duplicate, Rename, Archive, Delete | ✔ `tests/documents/library-actions.spec.ts` |
| DOC-018 | Row actions behaviour | P1 | Functional | Document exists | Duplicate, Rename, Move to folder, Download, Print | Each action applies and is reflected in list/audit | M |
| DOC-019 | Layout & bulk selection | P3 | UI | Signed in | Toggle List/Grid; Select all | Layout switches; selection count/bulk bar appears | ✔ (controls) / M |
| DOC-020 | Form catalog | P2 | Functional | Templates folder | Browse form catalog → search/category → add | Catalog dialog; adding copies form into Templates | ✔ (dialog) / M (add) |
| DOC-021 | Unknown document id | P2 | Negative | Signed in | Open `/documents/<random-uuid>/prepare` | "This document isn't available" + Go to documents; no data leak | ✔ |
| DOC-022 | Quota exhausted | P0 | Negative | 6/6 requests used | Upload a new document | Upload refused (HTTP 402) with upgrade guidance; no draft created | M |
| DOC-023 | Search documents | P1 | Functional | ≥2 documents | Type title / ENV id / recipient in **Search documents** | Matching rows only; count updates; empty state for no match | M |

## 4a. Templates (`TPL`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| TPL-001 | Save draft as template | P1 | Functional | Draft with fields | Builder → Save as template → name → Save template | Template listed in Templates with the same field count | ◐ (setup step of TPL-002) |
| TPL-002 | Template name is unique | P1 | Negative | Template "X" exists | Save another template named "X" | Rejected with an "already exists" error; still one "X" (**BUG-07**) | ✔ `tests/bugs/…` (`@data`) |
| TPL-003 | Rename template to an existing name | P2 | Negative | Two templates | More actions → Rename → other template's name | Rejected (**BUG-07**, rename path — observed accepted) | M |
| TPL-004 | Delete a template | P1 | Functional | Test template exists | More actions → Delete → confirm | Removed / moved to Trash with feedback. Observed: no request, no confirmation, template stays (**BUG-10**); Archive behaves the same | ✔ `tests/bugs/…` |
| TPL-005 | Start an envelope from a template | P1 | E2E | Template + quota | Use template | Draft created with the template's fields; builder opens | ⛔ quota (M) |

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
| PREP-014 | Preview signer view | P1 | Functional | Draft with fields | Click **Preview** | Signer-view opens in preview mode with the placed fields | ✔ `tests/flows/envelope-preparation.flow.spec.ts` |
| PREP-015 | Save and close | P1 | Functional | Draft modified | Save and close | Returns to Documents; draft listed with correct status | ✔ `tests/flows/library.flow.spec.ts` |
| PREP-016 | Canvas toolbar & pages panel | P2 | Functional | Draft open | Inspect toolbar | Undo/Redo, zoom, fit, snap, align, distribute, duplicate, find fields, Add page present | ✔ `tests/documents/builder-details.spec.ts` |
| PREP-017 | Add recipient from contacts | P2 | Functional | Contact exists | Manage recipients → Add from contacts | Picker lists contacts; chosen contact prefills e-mail/role | M |
| PREP-018 | Rename & autosave | P2 | Functional | Draft open | Rename document; place/move a field | Title updates in library; "N fields · autosaved" updates; survives reload | ✔ `tests/flows/envelope-preparation.flow.spec.ts` |
| PREP-019 | Field text readable on dark pages | P2 | UI | Draft with fields | Place a field on a page with a black background | Field label/placeholder keep ≥ 3:1 contrast on black and on white pages (**BUG-01**) | ✔ `tests/bugs/reported-defects.spec.ts` |
| PREP-020 | Favourite moves a field to the top | P3 | Functional | Builder palette | Favourite a field that is not yet a favourite | It moves above every non-favourite in **All fields**; **Favourites** lists exactly the favourites (**BUG-02**) | ✔ `tests/bugs/…`, `tests/ui/prepare.ui.spec.ts` |
| PREP-021 | Warn before opening another document | P2 | Functional | Draft open in builder | Open a different document from global search or the library | Confirmation to close the current document; Cancel keeps it open (**BUG-04**) | ✔ `tests/bugs/…` |
| PREP-022 | Placeholder shown on the canvas | P2 | Functional | Field selected | Inspector → Placeholder → type text | Canvas field shows the placeholder while editing; persists after reload (**BUG-05**) | ✔ `tests/bugs/…`, `tests/flows/envelope-preparation.flow.spec.ts` |
| PREP-023 | Document-name length validation | P2 | Negative | Draft open | Rename to 256+ characters → Enter | Rejected; user-facing message naming the limit (e.g. "Document name must be 255 characters or fewer") in the error colour; name unchanged. Observed: raw `String should have at most 255 characters` in grey (**BUG-06**) | ✔ `tests/bugs/…` |
| PREP-024 | Place & configure a field (journey) | P1 | E2E | Draft open | Search palette → place Text Input → label + placeholder → reload → rename → preview → workflow → delete | Every checkpoint of UF-19 holds; draft restored | ✔ `tests/flows/envelope-preparation.flow.spec.ts` |

## 6. Signing workflow (`WF`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| WF-001 | Workflow page loads | P1 | Smoke | Draft with recipient | Click **2 Workflow** | "Workflow & routing" with all sections | ✔ |
| WF-002 | Sequential vs parallel | P1 | Functional | ≥2 recipients | Toggle routing modes | Mode persists; order controls reflect the choice | ✔ (visibility) / M |
| WF-003 | Invite preview | P2 | Functional | Recipient present | Edit subject/message | Preview updates live; merge tokens resolve to recipient/document values | ✔ (section) / M |
| WF-004 | Payment request | P2 | Functional | Stripe connected | Enable payment, choose single/split/custom, save | Payment request saved; requires a placed payment field | ✔ (blocked without Stripe) / M |
| WF-005 | Before-you-send checklist | P1 | Functional | Incomplete envelope | Inspect checklist | Each pending item (e-mail, fields, disclosure, certificate) flagged with deep link | ✔ (section) / M |
| WF-006 | Expiration (reminder cadence removed 20 Nov 2026) | P1 | Functional | Workflow open | Choose 24h/48h/7d/none + expiry | Selection persists after save/reload | ✔ (options) / M (persist) |
| WF-007 | Branding theme | P2 | Functional | Theme exists | Select theme | Invite preview reflects logo/colours | ✔ (section) / M |
| WF-008 | Delivery simulation | P2 | Functional | Workflow open | Open simulation | Shows recipient delivery experience without sending | ✔ (section) / M |
| WF-009 | Send blocked without recipient/fields | P0 | Negative | Draft without recipient | Send envelope | Blocked with actionable errors; nothing sent; quota unchanged | M |
| WF-010 | Send envelope golden path | P0 | E2E | Recipient with real mailbox, quota | Complete checklist → Send | Status Waiting for others; recipient receives invite; audit entries created | M |
| WF-011 | Missing recipient e-mail is blocking | P1 | Negative | Recipient without e-mail | Workflow → Before you send; Save the empty e-mail | Checklist item is a blocking **error** (error colour, wording says the e-mail is required to send). Inline "Enter an email address" in error colour. Observed: amber advisory (**BUG-08**) | ✔ `tests/bugs/…`, `tests/ui/workflow.ui.spec.ts` |
| WF-012 | Recipients edited in one place | P3 | UX | Workflow step | Inspect Recipients & signing order | Recipients read-only with **Manage recipients**; no inline e-mail/name editors (**BUG-09**, product decision) | ✔ `tests/bugs/…` |

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
| SIGN-008 | Preview every recipient's view | P2 | Functional | Draft with ≥ 1 recipient | Preview → **Preview as** | One entry per recipient with their fields, plus an "All recipients" overview (**BUG-03**) | ✔ `tests/bugs/…`, `tests/flows/envelope-preparation.flow.spec.ts` |

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
| CON-009 | Search contacts | P2 | Functional | ≥2 contacts | Search by name/e-mail/company | Matching rows only; empty state for no match | ✔ (global search) `tests/flows/contacts.flow.spec.ts` / M (list search) |
| CON-010 | Group filter chips | P3 | Functional | Contacts in ≥2 groups | Click a group chip | Only that group listed; chip counts match rows | M |

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

## 10. Developer platform (`DEV`) — retired

Removed from the product on 20 Nov 2026 (sidebar entry gone; `/developer/*` redirects to the overview or shows "That page isn't here"). Tests and scenarios retired; the backend `/api/proxy/webhooks*` endpoints still answer and stay covered by the API contract tests. DEV-001…DEV-016 are no longer part of the suite; BUG-18 is closed.

## 11. Support (`SUP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| SUP-001 | Support dashboard | P1 | Smoke | Signed in | Open `/support` | Counters (All/Open/Escalated/Pending/Resolved/Breached/Unassigned/P1 open), New ticket, filters | ✔ |
| SUP-002 | New ticket dialog | P1 | Functional | Support page | Click **New ticket** | Subject, Category (5), Priority (P1–P4), Related envelope, Description, Submit | ✔ |
| SUP-003 | Priority/category inventory | P2 | Functional | Dialog open | Inspect selects | Categories and P1–P4 labels exactly as documented | ✔ |
| SUP-004 | Empty ticket submit | P1 | Negative | Dialog open | Submit without required fields | Validation message for each missing field in the error colour; dialog stays; no ticket created (**BUG-11**, FEATURES O9 — observed: nothing happens) | ✔ `tests/ui/support.ui.spec.ts` |
| SUP-005 | Create ticket + SLA | P1 | Functional | Dialog open | Submit valid P2 ticket | Ticket listed under Open with SLA; counters increment | M |
| SUP-006 | Filters/sort | P2 | Functional | ≥2 tickets | Filter status/priority, sort by SLA risk | List and counters reflect filters; sort stable | ✔ (controls) / M (with data) |
| SUP-007 | Queue controls | P2 | Functional | Support page | Inspect search, sort, Export CSV, status/attention chips, pagination | All present with expected options | ✔ `tests/support/support-queue.spec.ts` |
| SUP-008 | Default priority | P3 | Functional | New ticket | Open dialog | Priority defaults to P3 · Normal | ✔ |

## 12. Account, security & settings (`ACC`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| ACC-001 | Profile loads | P1 | Smoke | Signed in | Open `/account/profile` | Name, verified e-mail, time zone, language, photo, Save disabled | ✔ |
| ACC-002 | Profile values | P1 | Functional | Signed in | Inspect fields | Name `Mokaddes SQA`, e-mail matches account, "Email verified <date>" | ✔ |
| ACC-003 | Edit profile | P1 | Functional | Profile | Change time zone/language → Save | Save enables; values persist; toast/status confirms | ✔ `tests/flows/account.flow.spec.ts` |
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
| ACC-014 | Organization & teams | P2 | Functional | Signed in | Open `/account/organization` | Members, roles, invites, seats; admin can invite/remove | ✔ (page, invite validation, heading text **BUG-12**) / M (invite) |
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
| BIL-002 | Plan catalogue | P1 | Functional | Billing | Open **Change plan** | Free $0, Team $12/seat, Business $28/seat, Enterprise $499 | ✔ (catalogue) · ✔ pre-selection `tests/ui/billing.ui.spec.ts` (**BUG-14**) |
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
| NF-002 | Mobile layout (Pixel 7) | P2 | Responsive | Mobile project | Browse documents, prepare, signer preview | Drawer nav, single-column cards, usable tap targets | ✔ 390 px baseline in every `tests/ui/*` file |
| NF-003 | Keyboard-only field placement | P2 | A11y | Builder open | Tab to field, press Enter | Field places without mouse; focus visible throughout | M |
| NF-004 | Accessible names/landmarks | P2 | A11y | Any page | Inspect roles | One h1, named regions/nav, labelled inputs, skip link works | ✔ baseline in every `tests/ui/*` file (h1, main, labels, names) |
| NF-005 | Cross-browser | P2 | Compatibility | Firefox/WebKit projects | Run `@smoke` | Same results as Chromium; no console errors | ✔ (projects) |
| NF-006 | Console health | P2 | Functional | Any module | Collect console messages | No uncaught exceptions; no failed API calls on happy path | ✔ uncaught errors fail `tests/ui/*`; console errors attached |
| NF-007 | 404 route | P2 | Functional | Signed in | Open `/documents/<unknown-id>` | "That page isn't here" with Back to overview / Open documents | ✔ `tests/navigation/navigation.spec.ts` |
| NF-008 | Session expiry | P1 | Security | Expired/removed session | Open protected route | Redirect to login with `next`; after re-auth return to route | M |
| NF-009 | XSS/injection smoke | P1 | Security | Any free-text field | Enter `<script>alert(1)</script>` in contact/subject/folder | Rendered as text; no script execution | M |
| NF-010 | Error/offline state | P3 | Negative | Offline | Trigger action | Friendly error/toast; no data corruption; retry works | M |
| NF-011 | No secrets in UI/logs | P0 | Security | API key flow | Create key then inspect reports/logs | Secret shown once only; not present in artifacts committed to git | M |
| NF-012 | Performance smoke | P3 | Performance | Cold load | Load each module | Interactive under ~3 s on broadband; no long blocking alerts | M |


## 15. Reported defects with reproduction tests (`BUG`)

Each defect has one test that asserts the **correct** behaviour: it fails while the
defect exists and passes once fixed. They are tagged `@bug` and listed on the dashboard's
**Known bugs** tab (`open` = still reproduces). Registry: `src/helpers/bugs.ts`.
CI runs them with `KNOWN_BUGS=expect-fail`, so a fixed bug shows up as an unexpected pass.

| Bug | Sev | Summary | Found | Case | Reproduction | Observed on 16 Nov 2026 |
|-----|-----|---------|-------|------|--------------|--------------------------|
| BUG-01 | S3 | Field text unreadable on a black document page | Manual 16 Nov | PREP-019 | `tests/bugs/reported-defects.spec.ts` | Label `rgb(13,20,43)` @ 0.78 on 12 % green fill → **1.02:1** contrast on black |
| BUG-02 | S4 | Favourited field does not move to the top of the palette | Manual 16 Nov | PREP-020 | same | Favourites stay in catalogue order (e.g. Checkbox after Initials, Pen Drawing last) |
| BUG-03 | S3 | Preview cannot show how all recipients see the document | Manual 16 Nov | SIGN-008 | same | Only "Preview as <one recipient>" links; no combined view |
| BUG-04 | S3 | Opening another document while one is open gives no warning | Manual 16 Nov | PREP-021 | same | Global search switched documents with no prompt |
| BUG-05 | S3 | Placeholder not shown on the editing canvas | Manual 16 Nov | PREP-022 | same | Canvas keeps showing the label ("Signature") |
| BUG-06 | S3 | Document-name limit error: wrong wording and colour | Manual 16 Nov | PREP-023 | same | `String should have at most 255 characters` in `rgb(79,104,139)` (slate, not error red) |
| BUG-07 | S2 | Template names not unique | Manual 16 Nov | TPL-002 | same (`@data`) | Two templates "QA Template (uniqueness check)" (TPL-D91881, TPL-FAD25C) accepted via Save and via Rename |
| BUG-08 | S3 | Missing recipient error: wrong wording and colour | Manual 16 Nov | WF-011 | same | "Recipients need an email" shown as amber advisory `rgb(169,92,0)` |
| BUG-09 | S4 | Inline recipient editor (UX: edit recipients in one place) | Manual 16 Nov | WF-012 | same | Workflow step has inline e-mail + name editors besides Manage recipients |
| BUG-10 | S2 | Template Delete / Archive do nothing | **Automation 16 Nov** | TPL-004 | same | No request sent within 12 s, no confirmation, template stays |
| BUG-11 | S3 | Empty support ticket gives no feedback | Walkthrough O9 | SUP-004 | `tests/ui/support.ui.spec.ts` | Earlier spec asserted the silent behaviour as "expected" |
| BUG-12 | S4 | "People1" heading — count glued to label | Walkthrough O7 | ACC-014 | `tests/ui/account.ui.spec.ts` | — |
| BUG-13 | S4 | Trust hero accessible name "eSignProhandles" | Walkthrough O8 | AUTH-021 | `tests/ui/public.ui.spec.ts` | Earlier spec loosened its regex to tolerate it |
| BUG-14 | S4 | Change-plan dialog pre-selects Enterprise on Free | Walkthrough O6 | BIL-002 | `tests/ui/billing.ui.spec.ts` | "Enterprise $499.00" pre-selected |
| BUG-15 | S4 | Registration error shown in neutral grey, not error colour | **UI layer 16 Nov** | AUTH-004 | `tests/ui/auth.ui.spec.ts` | "Name and company are required" in `rgb(79,104,139)`, the same grey as BUG-06, so form errors look wrong app-wide |
| BUG-16 | S4 | **Intermittent** React hydration error #418 (server/client text mismatch) | **UI layer 16 Nov** | NF-006 | UI baseline records it as an `issue` annotation, not a failure | Thrown on every local run of `/developer/logs` on 16 Nov, then not reproduced locally or on CI in any timezone. Likely data-dependent (very recent log timestamps) |
| BUG-17 | S3 | Saving a contact without a name does nothing | **UI layer 16 Nov** | CON-005 | `tests/ui/contacts.ui.spec.ts` | Dialog stays; no message; field not flagged |
| BUG-18 | S3 | Webhook "Create endpoint" enabled for a non-URL value | **UI layer 16 Nov** | DEV-014 | `tests/ui/developer.ui.spec.ts` | Disabled when empty, enabled after typing "not a url" (never submitted) |

### Why the suite did not catch BUG-01…BUG-09

1. **Presence, not outcome.** Specs asserted that controls exist (favourite toggle,
   Placeholder input, Preview link, Save as template) but never used them and checked
   the result where a user would look.
2. **No visual or semantic checks.** Nothing compared colours, contrast or message
   wording, so wrong-colour and raw-text errors (BUG-01/06/08) passed.
3. **Tests wrote the bug into the expectation.** O8 and O9 were already known, and
   their specs were changed to pass against the broken behaviour.
4. **No cross-screen journeys.** Switching documents, previewing as every recipient and
   name uniqueness only show up across steps. That is what `USER_FLOWS.md` and
   `tests/flows/` now cover.
5. **Single-state data.** One draft, one recipient, light theme, white page: no dark
   page, no second template, no second recipient.

The fixes for each cause are in `TEST_PLAN.md` §4.3.

## 16. Module UI checks (`tests/ui`)

Every module has its own UI spec. Each route gets the **baseline** (one h1, a `main`
landmark, no horizontal scroll at 1440 px, every control and button named, no broken
images, no `NaN`/`undefined`/`[object Object]` rendered, no uncaught JS errors), plus a
**390 px phone-width** and a **dark-scheme readability** check, plus module-specific
UI assertions.

| ID | Module | Spec | Routes | Module-specific checks |
|----|--------|------|--------|------------------------|
| UI-001 | Public site | `tests/ui/public.ui.spec.ts` | `/`, `/pricing`, `/trust`, `/security`, `/legal`, `/changelog`, `/verify` | Header CTAs; BUG-13 |
| UI-002 | Authentication | `tests/ui/auth.ui.spec.ts` | `/login`, `/register`, `/login/forgot` | Password masking/reveal; validation and login errors in error colour; tab state |
| UI-003 | Application shell | `tests/ui/navigation.ui.spec.ts` | global | Skip link; sidebar names and `aria-current`; search focus/Escape; account menu; theme and sidebar toggles (restored) |
| UI-004 | Overview | `tests/ui/overview.ui.spec.ts` | `/overview` | KPI values; chart data alternative |
| UI-005 | Documents | `tests/ui/documents.ui.spec.ts` | `/documents`, templates, trash | Empty search state; menu focus return; folder dialog; result count |
| UI-006 | Builder | `tests/ui/prepare.ui.spec.ts` | `/documents/prepare`, `/documents/{id}/prepare` | Favourite state; Favourites tab; palette search; inspector labels; field contrast on white; zoom |
| UI-007 | Workflow | `tests/ui/workflow.ui.spec.ts` | `/documents/{id}/workflow` | Inline e-mail error in error colour + `aria-invalid`; routing state; invite preview; checklist icons |
| UI-008 | Signer preview | `tests/ui/signer.ui.spec.ts` | `/documents/{id}/signer-view` | Preview status; progress value; mobile toggle; preview-as counts |
| UI-009 | Contacts | `tests/ui/contacts.ui.spec.ts` | `/contacts` | Dialog labels/focus/Escape; blank-name flagged; group filters |
| UI-010 | Reports | `tests/ui/reports.ui.spec.ts` | 6 sections | Table headers; no empty recipient names (O4) |
| UI-012 | Support | `tests/ui/support.ui.spec.ts` | `/support` | Dialog labels; BUG-11 |
| UI-013 | Account | `tests/ui/account.ui.spec.ts` | 9 routes | Save disabled when clean; one colour mode; password dialog labels; switches; BUG-12 |
| UI-014 | Billing | `tests/ui/billing.ui.spec.ts` | `/account/billing` | Summary not blank (O1); seat cost preview; BUG-14 |

## 17. Coverage-gap cases added 17 Nov 2026 (API, integration, security, performance, a11y, compatibility)

Added after the QA coverage analysis (`qa-reports/`). All are read-only against production
unless stated. The full scenario list with execution status is in
`qa-reports/QA_Coverage_Matrix.xlsx`; the catalogue that drives it is `qa-reports/catalog.py`.

| ID | Category | Spec | What it proves |
|----|----------|------|----------------|
| API-001…010 | Integration / API | `tests/api/api-contract.spec.ts` | `/api/proxy/*` contracts: types, tenant isolation, 404/4xx (no 5xx, no stack traces), quota arithmetic, content types, TRACE refused |
| INT-001…006 | Integration | `tests/integration/data-consistency.spec.ts` | UI figures equal API figures: library count/titles, contact & group counts, plan-usage %, developer meter, profile |
| SEC-001…016 | Security | `tests/security/security.spec.ts` | HTTPS redirect, security headers, server-version disclosure, cookie flags, anonymous API denial, guest deep links, IDOR, no secrets in payloads, reflected XSS, open redirect, account enumeration (login + reset), password autocomplete, SQL meta-characters |
| SESS-001…003 | Security | `tests/security/session.spec.ts` | Session loss → login with `next` (NF-008), forged cookie rejected, sign-out revokes the session server-side (AUTH-019, **opt-in `RUN_SIGNOUT=true`, run alone, then `npm run auth:refresh`**) |
| PERF-001…005 | Performance | `tests/performance/performance.spec.ts` | Page-load budgets (TTFB ≤ 1.5 s, DCL ≤ 3 s, load ≤ 5 s), API p95 ≤ 1.5 s, 10-request concurrency smoke, recovery after burst (NF-012). Not a load test |
| A11Y-001…008 | Accessibility | `tests/a11y/accessibility.spec.ts` | axe-core WCAG 2.1 A/AA on 14 pages (critical/serious fail), Tab order, visible focus, `lang` + autocomplete, 320 px reflow, modal focus trap and focus return |
| COMP-001…003 | Compatibility | `tests/compatibility/viewports.spec.ts` | 360 / 768 / 1024 / 1920 px layouts and navigation (complements the firefox / webkit / mobile-chrome projects) |
| AUTH-025…032 | Functional (negative/boundary) | `tests/auth/auth-validation.spec.ts` | Malformed e-mail, password 11 vs 12 chars, missing character classes, weak password, whitespace name, over-long e-mail. **All non-GET requests are aborted** so a validation gap can never create a workspace |
| DOC-002/004/006/015/023 | Functional | `tests/documents/library-search.spec.ts` | Search by title / ENV id, empty state + clear, status filter, Drafts/Completed views, Recent and Name sort — each compared with the documents API |
| CON-009, CON-010 | Functional | `tests/contacts/contacts-search.spec.ts` | List search by name / e-mail / no match; group chips filter rows and counts match |
| SUP-006, SUP-009 | Functional | `tests/support/support-search.spec.ts` | Ticket search empty state, filter combination and reset, exclusive status chips |

Tags: `@api`, `@security`, `@perf`, `@a11y`, `@compat` (e.g. `npx playwright test --grep @security`).

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
| §5.1 New envelope, PREP-01…PREP-10 | PREP-001…PREP-024 |
| §4.1 Templates, PREP-10 | TPL-001…TPL-005 |
| WF-01…WF-09 | WF-001…WF-012 |
| SIGN-01…SIGN-06 | SIGN-001…SIGN-008, ACC-006 |
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
| §14 Observations O1…O13 | BIL-011, ACC-014, REP-010, SUP-004, DEV-016, AUTH-023 (defect retests); O6–O9 → BUG-11…BUG-14 |
| Manual session 16 Nov 2026 + automation | BUG-01…BUG-18 (§15) |
| Every module UI | UI-001…UI-014 (§16) |

---

## Coverage summary

| Module | Cases | Automated | Partly automated | Manual/planned |
|--------|------:|----------:|-----------------:|---------------:|
| Auth | 24 | 14 | 3 | 7 |
| Navigation | 10 | 8 | 1 | 1 |
| Overview | 8 | 5 | 0 | 3 |
| Documents | 23 | 8 | 3 | 12 |
| Templates | 5 | 2 | 1 | 2 |
| Prepare | 24 | 14 | 7 | 3 |
| Workflow | 12 | 3 | 7 | 2 |
| Signer | 8 | 3 | 1 | 4 |
| Contacts | 10 | 4 | 3 | 3 |
| Reports | 10 | 6 | 1 | 3 |
| Support | 8 | 6 | 1 | 1 |
| Account | 23 | 13 | 5 | 5 |
| Billing | 11 | 4 | 1 | 6 |
| Non-functional | 12 | 6 | 0 | 6 |
| **Total** | **204** | **105** | **37** | **62** |

"Partly automated" means the UI/controls are asserted automatically while the behaviour
(persisting, sending, e-mail) is still verified manually. In addition to these cases the
suite runs the 14 module UI specs (§16, ≈ 180 checks) and the user-flow journeys in
`tests/flows/` (see `USER_FLOWS.md`).

Every feature ID in [`FEATURES.md`](./FEATURES.md) maps to at least one case above.
Automated cases live in `tests/**` and run on every push (`@smoke`) or nightly (full).
Manual cases are executed per the phases in [`TEST_PLAN.md`](./TEST_PLAN.md).
