# eSignPro — Test Cases (module-wise)

Legend — **P** priority (P0–P3), **Type** (Smoke, Functional, Negative, E2E, A11y, UI),
**Auto** = automated by a Playwright spec (`✔`) or manual/planned (`M`). Case IDs are
referenced by test names and bug reports.

Environment: `https://esignpro.net`, test workspace **Global Softel** (Free plan), saved
session `auth/storageState.json`. Sample upload: `tests/fixtures/sample-agreement.png`.

---

## 1. Authentication (`AUTH`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| AUTH-001 | Landing page renders | P1 | Smoke | Guest | Open `/` | Hero, CTA ("Start free"), Log in, pricing and footer visible; title contains eSignPro | M |
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
| AUTH-012 | Login with valid credentials | P0 | Smoke | Verified account | `/login` → email + password → **Continue** | Redirect to OTP (if required) then `/overview` dashboard | ✔ (invalid only) / M |
| AUTH-013 | Login with wrong password | P0 | Negative | Guest on `/login` | Valid e-mail + wrong password → **Continue** | Stays on `/login`; error "invalid/incorrect/wrong"; no session | ✔ |
| AUTH-014 | Empty login submit | P1 | Negative | Guest on `/login` | Click **Continue** with empty fields | Required/validation feedback; no navigation | M |
| AUTH-015 | Show/hide password | P2 | UI | Guest on `/login` | Click **Show password** | Password becomes readable, icon toggles, focus preserved | M |
| AUTH-016 | Remember this device | P2 | Functional | Guest on `/login` | Toggle the switch | Switch state toggles; OTP skipped on next login when enabled (within trust window) | M |
| AUTH-017 | Forgot password link | P2 | Functional | Guest on `/login` | Click **Forgot password?** | `/login/forgot` opens with e-mail field | ✔ (link presence via page object) / M |
| AUTH-018 | Tab switch to Create account | P2 | Functional | Guest on `/login` | Click **Create account** tab | `/register` opens with the tab selected | ✔ |
| AUTH-019 | Sign out | P0 | Functional | Signed in | Account menu → **Sign out** | Session cleared; redirected to login/landing; back button cannot reopen app | M |
| AUTH-020 | Protected route redirect | P0 | Security | Guest (no session) | Open `/documents` | Redirected to `/login?next=…`; after login returned to intended page | M |

## 2. Navigation, search & theming (`NAV`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| NAV-001 | Sidebar exposes all modules | P1 | Smoke | Signed in | Open sidebar | Home, Documents, Contacts, Reports, Developer, Support, My account, Create, plan widget visible | ✔ |
| NAV-002 | Sidebar navigation works | P1 | Functional | Signed in on Overview | Click **Contacts** | `/contacts` loads; Contacts marked active | ✔ |
| NAV-003 | Account & help menu | P2 | Functional | Signed in | Click **Account and help** | Menu shows name, e-mail, workspace, admin role, My account, Notifications, Start product tour, Support centre, Contact support, Guides & docs, API console, Sign out | ✔ |
| NAV-004 | Global search shortcut | P2 | Functional | Signed in | Press `Ctrl/Cmd+K` | "Search your workspace" dialog opens, focused Search combobox, hint "Type at least 2 characters" | ✔ |
| NAV-005 | Global search results | P2 | Functional | Signed in, existing doc/contact | Open search → type ≥ 2 chars | Grouped results (documents, templates, contacts, members); Enter opens the item | M |
| NAV-006 | Theme toggle | P3 | UI | Signed in | Click **Switch to dark theme** | Theme switches to dark, persists on reload/profile | M |
| NAV-007 | Collapsible sidebar | P3 | UI | Desktop ≥ 1280px | Click **Collapse sidebar** | Sidebar collapses to icon rail, content expands, preference persists | M |
| NAV-008 | Mobile drawer | P3 | Responsive | Pixel 7 viewport | Open navigation | Drawer overlays content, closes on backdrop/Escape, links usable | M |

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
| DOC-009 | Upload & prepare (file chooser) | P0 | E2E | Quota available | Upload PDF/image | Draft created, routed to `/documents/{id}/prepare` | ✔ (`@quota`) |
| DOC-010 | Upload unsupported file | P1 | Negative | Any | Choose `.exe`/oversized file | Rejected with clear error; no draft created | M |
| DOC-011 | Templates folder | P2 | Functional | Signed in | Open Templates | Templates view + **Browse form catalog**; empty state if none | ✔ |
| DOC-012 | Row content | P2 | Functional | Document exists | Inspect row | Title, `ENV-…`, page count, status, signer count, updated time, action visible | M |
| DOC-013 | Archive / Trash lifecycle | P2 | Functional | Document exists | Archive → open Archive → restore; Trash → restore/delete | Document moves between views; restore returns it; delete removes permanently | M |
| DOC-014 | Favourites / sharing views | P2 | Functional | Document exists | Favourite a document; share with team member | Appears under Favourites / Shared with me as appropriate | M |
| DOC-015 | Empty state | P3 | UI | Filter with no matches | Apply impossible filter combo | Friendly empty state with clear-filters action; no errors | M |
| DOC-016 | Pagination | P2 | Functional | > page-size documents | Navigate pages | Count "Showing X of Y"; page controls preserved with filters | M |

## 5. Envelope preparation (`PREP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| PREP-001 | New envelope landing | P1 | Smoke | Signed in | Open `/documents/prepare` | Heading, Choose a file, Start from a template, 3-step explainer visible | ✔ |
| PREP-002 | Upload opens builder | P0 | E2E | Quota | Choose file | Draft created, builder opens with document rendered | ✔ (`@quota`) |
| PREP-003 | Recipients panel | P0 | Functional | Draft open | Inspect panel | Add recipient + Manage recipients available; recipient 1 status "Pending / Needs to sign" | ✔ |
| PREP-004 | Add recipient & roles | P1 | Functional | Draft open | Add recipient → set name/email/role | Recipient appears with role (signer/approver/CC/in-person) and field count 0 | M |
| PREP-005 | Manage recipients | P1 | Functional | ≥1 recipient | Manage recipients → rename, reorder, remove | Changes persist after save/reload | M |
| PREP-006 | Field palette inventory | P1 | Functional | Draft open | Inspect palette + search/favourites | Signature, Initials, Date and Time, Date Signed, Full Name, Email, Text Input, Checkbox, Radio Group, Dropdown, Stamp, Attachment, Number, Text Box, Pen, Payment | ✔ (subset) / M |
| PREP-007 | Place signature field | P0 | Functional | Draft open | Focus Signature → Enter (or drag) | Field placed, count increments, autosave indicator updates | ✔ |
| PREP-008 | Assign field to recipient | P1 | Functional | Field + 2 recipients | Place field, select recipient in inspector | Field bound to that recipient; recipient field count updates | M |
| PREP-009 | Validation/required rules | P1 | Functional | Text/number field placed | Set required, min/max, pattern, help text | Inspector persists rules; preview enforces them | M |
| PREP-010 | Conditional logic | P2 | Functional | Two fields | Configure show/hide dependency | Preview shows/hides dependent field correctly | M |
| PREP-011 | Pages panel | P2 | Functional | Multi-page PDF | Add/insert/reorder/delete page | Thumbnails and pagination update; fields remain attached correctly | M |
| PREP-012 | Inspector tools | P2 | Functional | Field placed | Duplicate, copy to every page, align, snap, zoom, undo/redo | Each action applies and can be undone; autosave persists | M |
| PREP-013 | Download PDF / save as template | P2 | Functional | Draft open | Download PDF; Save as template | PDF downloads with fields; template appears in Templates folder | M |
| PREP-014 | Preview signer view | P1 | Functional | Draft with fields | Click **Preview** | Signer-view opens in preview mode with the placed fields | M |
| PREP-015 | Save and close | P1 | Functional | Draft modified | Save and close | Returns to Documents; draft listed with correct status | M |

## 6. Signing workflow (`WF`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| WF-001 | Workflow page loads | P1 | Smoke | Draft with recipient | Click **2 Workflow** | "Workflow & routing" with all sections | ✔ |
| WF-002 | Sequential vs parallel | P1 | Functional | ≥2 recipients | Toggle routing modes | Mode persists; order controls reflect the choice | ✔ (visibility) / M |
| WF-003 | Invite preview | P2 | Functional | Recipient present | Edit subject/message | Preview updates live; merge tokens resolve to recipient/document values | ✔ (section) / M |
| WF-004 | Payment request | P2 | Functional | Stripe connected | Enable payment, choose single/split/custom, save | Payment request saved; requires a placed payment field | M |
| WF-005 | Before-you-send checklist | P1 | Functional | Incomplete envelope | Inspect checklist | Each pending item (e-mail, fields, disclosure, certificate) flagged with deep link | ✔ (section) / M |
| WF-006 | Reminders & expiration | P1 | Functional | Workflow open | Choose 24h/48h/7d/none + expiry | Selection persists after save/reload | ✔ (section) / M |
| WF-007 | Branding theme | P2 | Functional | Theme exists | Select theme | Invite preview reflects logo/colours | ✔ (section) / M |
| WF-008 | Delivery simulation | P2 | Functional | Workflow open | Open simulation | Shows recipient delivery experience without sending | ✔ (section) / M |
| WF-009 | Send blocked without recipient/fields | P0 | Negative | Draft without recipient | Send envelope | Blocked with actionable errors; nothing sent; quota unchanged | M |
| WF-010 | Send envelope golden path | P0 | E2E | Recipient with real mailbox, quota | Complete checklist → Send | Status Waiting for others; recipient receives invite; audit entries created | M |

## 7. Signer experience (`SIGN`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| SIGN-001 | Preview modes | P2 | Functional | Signer view open | Toggle Desktop / Mobile | Layout switches; fields remain readable/usable | M |
| SIGN-002 | Start signing & fields | P1 | Functional | Sent envelope (manual) | Start signing → complete fields | Required fields enforced; progress updates | M |
| SIGN-003 | Disclosure consent | P0 | Functional | Signing session | Open Disclosure | E-records disclosure shown; consent required before finish | M |
| SIGN-004 | Decline flow | P1 | Functional | Signing session | Decline + reason | Envelope marked declined; sender notified; audit entry | M |
| SIGN-005 | Reassign | P2 | Functional | Signing session | Reassign to another e-mail | New recipient receives invite; original cannot sign | M |
| SIGN-006 | Finish & certificate | P0 | E2E | All fields filled | Finish | Completion page; signed PDF/certificate downloadable; hash-chained audit intact | M |

## 8. Contacts (`CON`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| CON-001 | Address book renders | P1 | Smoke | Signed in | Open `/contacts` | Heading, address book + columns Contact/Company/Group/Source/Last signed/Envelopes | ✔ |
| CON-002 | New contact dialog | P1 | Functional | `/contacts` | Click **New contact** | Fields: Full name, Company, Email, Job title, Default role, Group; Cancel/Save | ✔ |
| CON-003 | Role & group options | P2 | Functional | Dialog open | Inspect selects | Roles: Needs to sign, Approver, Receives a copy, In-person signer; Groups: Customers, Internal, Counsel, Vendors | ✔ |
| CON-004 | Create contact | P1 | Functional | Dialog open | Fill valid values → Save | Contact saved; detail page opens with details + activity; row appears in list | ✔ |
| CON-005 | Required/format validation | P1 | Negative | Dialog open | Save blank / invalid e-mail / duplicate e-mail | Inline errors; dialog stays; nothing saved | M |
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
| REP-005 | Document/template reports | P2 | Functional | Reports open | Open By document / By template | Per-document/template metrics with totals | M |
| REP-006 | Custom report builder | P2 | Functional | Reports open | Open Custom report → choose dimensions | Filter builder works; preview/export available | M |
| REP-007 | Export report | P2 | Functional | Reports open | Click **Export report** | Download starts with selected range/section; file is valid | M |
| REP-008 | Empty period | P3 | UI | No activity in range | Select range with no data | Zeroed metrics and clear empty state (no NaN/errors) | M |

## 10. Developer platform (`DEV`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| DEV-001 | Developer overview | P2 | Smoke | Signed in | Open `/developer/api` | Heading, add-on summary, usage metrics | ✔ |
| DEV-002 | Usage metrics | P2 | Functional | Developer page | Inspect metrics | Requests/24h, p95, error rate, active keys, embed sessions show numbers | ✔ |
| DEV-003 | Section navigation | P2 | Functional | Developer page | Open API keys / Webhooks | URL `?section=…`; correct panel renders | ✔ |
| DEV-004 | API keys empty state | P2 | Functional | No keys | Open API keys | "No API keys yet" + Create key | ✔ |
| DEV-005 | Create API key | P1 | Functional | API keys page | Create key → name/scopes → confirm | Secret shown once; key listed with scopes; copy works | M |
| DEV-006 | Roll/revoke key | P1 | Security | Key exists | Roll then revoke | Old secret invalid immediately; revoked key cannot call API | M |
| DEV-007 | Scopes inventory | P2 | Functional | API keys page | Inspect scopes | users:read, contacts:read/write, documents:read/write, envelopes:send, audit:read, partner:manage | ✔ |
| DEV-008 | API console | P2 | Functional | Developer page | Open API console → compose call → Send request | Request executed against workspace; response/status/headers shown | ✔ (UI) / M (call) |
| DEV-009 | Guides & docs | P2 | Functional | Developer page | Open Guides | Quickstart, reference, embedding, webhooks, partner, migration docs | ✔ |
| DEV-010 | Activity logs / webhooks | P2 | Functional | Developer page | Open Activity logs and Webhooks | Log rows/filters; webhook signature + retry guidance | M |
| DEV-011 | Partner page | P2 | Functional | Developer page | Open Become a partner | Partner/reseller provisioning info and CTA | M |

## 11. Support (`SUP`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| SUP-001 | Support dashboard | P1 | Smoke | Signed in | Open `/support` | Counters (All/Open/Escalated/Pending/Resolved/Breached/Unassigned/P1 open), New ticket, filters | ✔ |
| SUP-002 | New ticket dialog | P1 | Functional | Support page | Click **New ticket** | Subject, Category (5), Priority (P1–P4), Related envelope, Description, Submit | ✔ |
| SUP-003 | Priority/category inventory | P2 | Functional | Dialog open | Inspect selects | Categories and P1–P4 labels exactly as documented | ✔ |
| SUP-004 | Empty ticket submit | P1 | Negative | Dialog open | Submit without required fields | Validation errors; dialog stays; no ticket created | ✔ |
| SUP-005 | Create ticket + SLA | P1 | Functional | Dialog open | Submit valid P2 ticket | Ticket listed under Open with SLA; counters increment | M |
| SUP-006 | Filters/sort | P2 | Functional | ≥2 tickets | Filter status/priority, sort by SLA risk | List and counters reflect filters; sort stable | M |

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
| ACC-008 | Change password validation | P1 | Negative | Change password dialog | Wrong current / weak new / mismatch | Inline errors; password unchanged | M |
| ACC-009 | Login & security controls | P1 | Functional | Signed in | Open `/account/security` | 2FA, Passkeys, SSO SAML, authenticated devices sections | ✔ |
| ACC-010 | Enable 2FA / add passkey | P1 | Functional | Security page | Connect 2FA; Add passkey | Setup flow completes/offers recovery; device registered | M |
| ACC-011 | Device session control | P1 | Security | Multiple sessions | Forget a device; Forget all | Session revoked; user signed out on that device | M |
| ACC-012 | Notification preferences | P2 | Functional | Signed in | Open `/account/notifications` | All 8 event preferences listed; toggles persist | ✔ |
| ACC-013 | Integrations | P2 | Functional | Signed in | Open `/account/integrations` | Catalogue + connect flow renders with statuses | M |
| ACC-014 | Organization & teams | P2 | Functional | Signed in | Open `/account/organization` | Members, roles, invites, seats; admin can invite/remove | M |
| ACC-015 | Audit trail | P1 | Functional | Signed in | Open `/account/audit` | Table Event/User/Details/Document/IP/Time; filters + pagination; empty state text | M |
| ACC-016 | Payments & branding | P2 | Functional | Signed in | Open `/account/payments`, `/account/brand` | Payment methods/receipts; theme editor with preview | M |
| ACC-017 | Notifications centre | P2 | Functional | Signed in | Open `/notifications` | List, read state, filters, mark read | M |
| ACC-018 | Deep link as guest | P0 | Security | Guest | Open `/account/security` | Redirect to `/login?next=…`; no data leaked | M |

## 13. Billing & plan (`BIL`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| BIL-001 | Billing page | P1 | Smoke | Signed in | Open `/account/billing` | Plan card (Free), renewal, usage, billing e-mail, invoices table | ✔ |
| BIL-002 | Plan catalogue | P1 | Functional | Billing | Open **Change plan** | Free $0, Team $12/seat, Business $28/seat, Enterprise $499 | ✔ |
| BIL-003 | Seats dialog | P1 | Functional | Billing | Open **Add seats** | Seats input, prorated-today and next-invoice preview, confirm | ✔ |
| BIL-004 | Payment method | P1 | Functional | Billing | Click **Add payment method** | Card form (Stripe) opens; validation for number/expiry/CVC; cancel safe | M |
| BIL-005 | No payment method state | P2 | Functional | Free plan | Inspect billing | "No payment method on file"; invoices empty state | ✔ |
| BIL-006 | Enterprise trial | P2 | Functional | Billing | Open plan → Start 30-day free trial | Trial terms shown; no charge until end; plan updates only on confirm | M |
| BIL-007 | Change plan guard | P0 | Functional | No card | Select paid plan → Switch plan | Prompts for payment method; plan and charge are not applied silently | M |
| BIL-008 | Invoices | P2 | Functional | Billing | Click All invoices & receipts | Full invoice list with download; pagination | M |

## 14. Non-functional & cross-cutting (`NF`)

| ID | Test case | P | Type | Precondition | Steps | Expected | Auto |
|----|-----------|---|------|--------------|-------|----------|------|
| NF-001 | Desktop layout 1440×900 | P1 | UI | Chromium | Browse every module | No overlap/truncation; sidebar persistent; tables scroll horizontally if needed | ✔ (implicit) |
| NF-002 | Mobile layout (Pixel 7) | P2 | Responsive | Mobile project | Browse documents, prepare, signer preview | Drawer nav, single-column cards, usable tap targets | M |
| NF-003 | Keyboard-only field placement | P2 | A11y | Builder open | Tab to field, press Enter | Field places without mouse; focus visible throughout | M |
| NF-004 | Accessible names/landmarks | P2 | A11y | Any page | Inspect roles | One h1, named regions/nav, labelled inputs, skip link works | M |
| NF-005 | Cross-browser | P2 | Compatibility | Firefox/WebKit projects | Run `@smoke` | Same results as Chromium; no console errors | ✔ (projects) |
| NF-006 | Console health | P2 | Functional | Any module | Collect console messages | No uncaught exceptions; no failed API calls on happy path | M |
| NF-007 | 404 route | P2 | Functional | Signed in | Open `/documents/<unknown-id>` | "That page isn't here" with Back to overview / Open documents | M |
| NF-008 | Session expiry | P1 | Security | Expired/removed session | Open protected route | Redirect to login with `next`; after re-auth return to route | M |
| NF-009 | XSS/injection smoke | P1 | Security | Any free-text field | Enter `<script>alert(1)</script>` in contact/subject/folder | Rendered as text; no script execution | M |
| NF-010 | Error/offline state | P3 | Negative | Offline | Trigger action | Friendly error/toast; no data corruption; retry works | M |
| NF-011 | No secrets in UI/logs | P0 | Security | API key flow | Create key then inspect reports/logs | Secret shown once only; not present in artifacts committed to git | M |
| NF-012 | Performance smoke | P3 | Performance | Cold load | Load each module | Interactive under ~3 s on broadband; no long blocking alerts | M |

---

## Coverage summary

| Module | Cases | Automated | Manual/planned |
|--------|------:|----------:|---------------:|
| Auth | 20 | 8 | 12 |
| Navigation | 8 | 4 | 4 |
| Overview | 8 | 6 | 2 |
| Documents | 16 | 6 | 10 |
| Prepare | 15 | 6 | 9 |
| Workflow | 10 | 5 | 5 |
| Signer | 6 | 0 | 6 |
| Contacts | 9 | 4 | 5 |
| Reports | 8 | 4 | 4 |
| Developer | 11 | 6 | 5 |
| Support | 6 | 4 | 2 |
| Account | 18 | 7 | 11 |
| Billing | 8 | 3 | 5 |
| Non-functional | 12 | 2 | 10 |
| **Total** | **155** | **65** | **90** |

Automated cases live in `tests/**` and run on every push (`@smoke`) or nightly (full).
Manual cases are tracked in this table and executed per the phases in
[`TEST_PLAN.md`](./TEST_PLAN.md).
