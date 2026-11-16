# eSignPro — Feature Inventory

> Live walkthrough of **https://esignpro.net** re-verified on **13 Nov 2026** with the test
> workspace **Global Softel** (account in `.env` → `ESIGN_EMAIL`; plan: Free, 1 seat).
> Every route below was opened in the authenticated app (49 routes, plus guest pages), and
> menus/dialogs were opened and dismissed without submitting. Items marked *(not exercised)*
> were seen but not driven end-to-end (they send e-mail, spend quota, move money, or
> change security settings).
>
> **Workspace state at time of review:** 6 / 6 signature requests used (new uploads return
> `402`), 6 draft envelopes, 0 templates, 0 sent envelopes, 21 `QA Folder …` folders and
> 8 `QA Contact …` contacts left by automation runs.

---

## 1. Public site & authentication

| ID | Feature | Route | Notes |
|----|---------|-------|-------|
| PUB-01 | Marketing landing page | `/` | Hero, "From Document to Signature in Minutes", feature grid (e-signatures, templates, multiple recipients, workflows, real-time status), audiences, integrations, security, pricing teaser, FAQ, footer. Signed-in visitors are redirected to `/overview`. |
| PUB-02 | Pricing & plans | `/pricing`, `/pricing#plans` | Free / Team / Business / Enterprise, plan comparison, "What is a signature request?", free trial of paid plans. Plan CTAs deep-link to `/register?plan=…&cycle=…`. |
| PUB-03 | Trust centre | `/trust` | Data-handling table, sub-processors, DPA, shareable documents, link to document verification. |
| PUB-04 | Log in | `/login` | Work email + password, **Remember this device**, Forgot password, Continue, MFA notice, SSO notice. Protected routes redirect to `/login?next=<route>`. |
| PUB-05 | Forgot password | `/login/forgot` | Work email → **Send reset link**; single-use link valid 30 minutes; Back to sign in. |
| PUB-06 | Create account | `/register` | Full name, company, work email, password + strength meter (12+ chars, number, capital, symbol), company type, company size, Terms & disclosure checkbox. Accepts `?plan=&cycle=`. |
| PUB-07 | Identity verification | `/login/verify` | 6-digit e-mailed OTP, resend, 10-minute expiry. |
| PUB-08 | Tabbed auth | `/login`, `/register` | Sign in ↔ Create account tabs. |
| PUB-09 | Enterprise SSO redirect notice | `/login` | Enterprise tenants may be redirected to their IdP. |
| PUB-10 | 404 page | unknown route | HTTP 404, "That page isn't here", **Back to overview** / **Open documents**. |
| PUB-11 | Dark / light theme | global | Header toggle; also Profile → Colour mode. |
| PUB-12 | Responsive layout | global | Collapsible sidebar (Expand/Collapse), mobile drawer (Open/Close navigation). |
| PUB-13 | **Document verification** | `/verify` | Public page: anyone can check a signed document without an account. |
| PUB-14 | Security, legal, changelog, developers pages | `/security`, `/legal`, `/changelog`, `/developers` | Security posture; Terms / Privacy / DPA; versioned changelog (v2026.7.1 → v2026.9.3); developer marketing page. |

**Free-plan limits (from Developer → Plan usage):** 6 signature requests, 1,000 API calls,
100 MB storage, 20 SMS per cycle. Drafts count against the signature-request quota once
created.

---

## 2. Application shell

| ID | Feature | Notes |
|----|---------|-------|
| SHELL-01 | Main navigation | "Create envelope", Home, Documents, Contacts, Reports, Developer, Support, My account; contextual sub-navigation; Expand/Collapse sidebar. |
| SHELL-02 | Plan usage widget | "% of this month's envelopes used" link to billing. |
| SHELL-03 | Global search | Header button or `Ctrl/Cmd + K`; ≥ 2 characters; results grouped (Documents, Templates, Contacts, Members) with highlighted match, result count, "See all documents matching …". |
| SHELL-04 | Notifications popover | Header bell opens a "Notifications" popover with **See all notifications** → `/notifications`. |
| SHELL-05 | Account & help menu | Name, e-mail, workspace · role; My account, Notifications, Start product tour, Support centre, Contact support, Guides & docs, API console, Sign out. |
| SHELL-06 | Product tour | 10-step dialog (Back / Next / Skip tour) from the menu, Overview or Guides. |
| SHELL-07 | Status/alert regions | `role=status` and `role=alert` live regions on every page. |
| SHELL-08 | Accessibility | Skip-to-content link, landmarks, labelled controls, keyboard field placement, chart data table. |
| SHELL-09 | API-unavailable banner | When a backend call times out, pages show "Can't reach the eSignPro API" with **Retry** and render stale/blank values. |

---

## 3. Overview dashboard — `/overview`

| ID | Feature |
|----|---------|
| OVR-01 | Workspace summary: name, plan, renewal date ("Free · renews 13 Dec 2026"), attention count. |
| OVR-02 | KPI cards: Action required, Out for signature, Envelopes (90 days), Seats activated, Completion rate. |
| OVR-03 | "Start from a template" — most-used templates, Browse all templates, empty state pointing to the form catalog. |
| OVR-04 | Envelope volume chart (12 weeks), arrow-key reading, accessible data table. |
| OVR-05 | "Needs your attention" actionable list (e.g. "Every licensed seat is in use"). |
| OVR-06 | "Spend this cycle" — invoiced total, due date, autopay state, Billing & plan / View invoices. |
| OVR-07 | "Team activity" — member, role, last active, sent count. |
| OVR-08 | Take the tour; New envelope → `/documents/prepare`. |

---

## 4. Documents library — `/documents`

### 4.1 Folders & views

- **Folders:** All documents (count), Templates, Archive, Trash, plus user-created folders (`?folder=<uuid>`).
- **Views:** Waiting for me (`inbox`), Waiting for others (`outbox`), Drafts (`drafts`), Completed (`completed`),
  Expiring soon (`expiring`), Favourites (`favorites`), Shared with me (`shared`), Owned by me (`mine`), with counts.
- **Templates:** "0 templates · blueprints…", **Browse form catalog** dialog (search, category filter, add to templates).

### 4.2 Toolbar, list and row actions

| ID | Feature |
|----|---------|
| DOC-01 | Search documents. |
| DOC-02 | Filters — status (All, Action required, Waiting for others, Completed, Drafts, Voided), type (All, Agreements, NDAs, Order forms, HR documents), time (All, 7 days, 30 days, quarter, Custom range…), owner (All, Owned by me, My team, Shared with me). |
| DOC-03 | Sort — Recent, Name, Status, Owner (committed via `?sort=`). |
| DOC-04 | New folder dialog (Folder name → Create). |
| DOC-05 | Upload & prepare (file chooser: PDF, image, .docx) → draft → builder; blocked with HTTP 402 when quota is exhausted. |
| DOC-06 | Rows — title, `ENV-…` ID, page count, status, signer count, updated time, **Prepare and send**; clicking the title opens the builder. |
| DOC-07 | Result count ("Showing 6 of 6 documents"). |
| DOC-08 | Status lifecycle: Draft/Prepared → Waiting for others → Completed / Declined / Voided / Expired; Archive and Trash. |
| DOC-09 | Favourites and sharing views. |
| DOC-10 | Empty states per folder/filter. |
| DOC-11 | **Layout toggle** — List / Grid. |
| DOC-12 | **Bulk selection** — Select all / per-row checkboxes. |
| DOC-13 | **Row "More actions" menu** — Open, Copy link (disabled for drafts), Add fields, Make template, Notarize, Download, Print, Move to folder, Duplicate, Rename, Archive, Delete. |
| DOC-14 | Unknown/foreign document ID → "This document isn't available" with Go to documents. |

---

## 5. Envelope preparation builder

### 5.1 New envelope — `/documents/prepare`
"Start a new envelope": **Choose a file**, **Start from a template**, three-step explainer
(Choose the document → Prepare → Workflow), **Continue your most recent draft**, Back to documents.
"Launch embedded builder" (Developer) also lands here.

### 5.2 Builder — `/documents/{id}/prepare`

| ID | Feature |
|----|---------|
| PREP-01 | Rename document inline; "N fields · autosaved"; "1 page · 1 recipient". |
| PREP-02 | Steps **Prepare → Workflow**; Send for signature; Preview; Download PDF; Save as template; Save and close; Continue. |
| PREP-03 | Recipients panel — recipient cards (status, role, field count), Manage Recipient N, Add recipient. |
| PREP-04 | Field palette (All / Favourites, search): Signature, Initials, Date and Time, Date Signed, Full Name, Email, Text Input, Checkbox, Radio Group, Dropdown, Stamp, Attachment, Number, Text Box, Pen Drawing, Payment; favourite toggle per tile; drag tiles to reorder. |
| PREP-05 | Drag-and-drop **or** keyboard placement (focus tile → Enter places it mid-page). |
| PREP-06 | Pages panel — Add page, Go to page, Move up/down, Delete page, Insert pages after. |
| PREP-07 | Canvas toolbar — Undo, Redo, Zoom in/out, Fit width, Fit page, Snap grid, Align left, Center, Distribute, Duplicate, Copy to every page, Delete, Open preview, Find fields, lasso multi-select. |
| PREP-08 | **Inspector** — Label, Placeholder, Assigned recipient (+ New recipient), X / Y / Width / Height (points), Required, Read-only, Validation (None, Email, Date MM/DD/YYYY, Numeric, Custom regex), Conditional logic (trigger field; is checked / equals / is not empty; comparison value). |
| PREP-09 | **Manage recipients dialog** — rename, e-mail combobox, **Add from contacts**, role (Signer, In-person signer, Approver, Receives a copy), move up/down, remove, Add Recipient, Save and Continue. |
| PREP-10 | Save as template / Make template. |

---

## 6. Signing workflow — `/documents/{id}/workflow`

| ID | Feature |
|----|---------|
| WF-01 | Routing: **Sequential** / **Parallel** (with explanation text). |
| WF-02 | Recipients & signing order — e-mail combobox, optional name, per-recipient Save, role (Needs to sign, In-person signer, Receives a copy, Approver), Move up/down, Remove, Add recipient. |
| WF-03 | Invite e-mail — Subject, Message, Reset to template; live **Invite preview** (To, subject, greeting, role, document). |
| WF-04 | Payment request — Total amount, Currency (USD), Memo, Single payer / Split equally / Custom split, payer selection, "place one" payment-field link, inline validation list, Save payment request. Blocked until a Stripe account with charges is connected. |
| WF-05 | "Before you send" (advisory) — recipient e-mails, fields assigned, disclosure attached, certificate enabled. |
| WF-06 | Reminders — Every 24h / **48h (default)** / 7 days / No reminders; Expires after 7 / **14 (default)** / 30 / 90 days / On a date…. |
| WF-07 | Branding — theme picker or "Manage themes" (none on Free). |
| WF-08 | Delivery simulation — queued → notified → reminder → expiry/auto-void timeline. |
| WF-09 | Open builder, Back, Send envelope, Send for signature. |

---

## 7. Signer experience — `/documents/{id}/signer-view`

| ID | Feature |
|----|---------|
| SIGN-01 | Preview as a chosen recipient; Desktop / Mobile viewport. |
| SIGN-02 | Start signing, "Next: <field> · page N" guide, progress bar ("0 of 1 required fields"). |
| SIGN-03 | Disclosure (ESIGN consent). |
| SIGN-04 | Decline and Reassign. |
| SIGN-05 | Finish; Download unsigned PDF; "Preview only" status banner; Back to editing. |
| SIGN-06 | Adopt signature (SHA-256 binding notice). |

---

## 8. Contacts — `/contacts`

| ID | Feature |
|----|---------|
| CON-01 | Address book table: Contact (name + e-mail), Company, Group, Source, Last signed, Envelopes; "Showing X of Y contacts". |
| CON-02 | New contact dialog — Full name, Company, Email, Job title, Default role (Needs to sign / Approver / Receives a copy / In-person signer), Group (Customers / Internal / Counsel / Vendors); Cancel / Save contact. |
| CON-03 | Contact page `/contacts/{id}` — breadcrumb, Send envelope, Add as recipient, tabs **Documents** / **Contact details**, Edit contact. |
| CON-04 | Details: e-mail (mailto), phone, company, job title, address, description, default role, group, source, owner. |
| CON-05 | Activity: envelope count, last signed. |
| CON-06 | Exposed over `GET /v1/contacts`; injectable into embed sessions. |
| CON-07 | Search contacts; **group filter chips with counts** (All, Customers, Internal, Counsel, Vendors). |

---

## 9. Reports & analytics — `/reports`

| ID | Feature |
|----|---------|
| REP-01 | My Analytics scorecards — Completion rate, Median completion, Templates created, Documents created, Recipients. |
| REP-02 | Date range — Last 7 days, **Last 30 days (default)**, Last quarter, Last 12 months (every section). |
| REP-03 | Export report. |
| REP-04 | Sections: My analytics, All reports (`all`), By document (`documents`), By template (`templates`), By recipient (`recipients`), Custom report (`custom`). |
| REP-05 | Invites by outcome (Pending/expired, Completed, Declined, Cancelled + chart) and recipients table: Recipient, Created, Sent, Pending, Completed, Cancelled, Declined, **Completion time**, Rate. |
| REP-06 | Documents report: Document, Recipients, Signed, Status, Updated, Progress. |
| REP-07 | Templates report: Template, Uses, Fields, Owner, Updated; empty-period guidance. |
| REP-08 | All reports — 6 CSV exports: Documents, Templates, Templates usage, Completed copies, Recipients, Audit export. |
| REP-09 | Custom report — 9 dimensions (Document title, Envelope status, Sender, Recipient, Recipient status, Created, Completed, Age, Completion time) → columns; Save definition, Schedule weekly, Run report. |

---

## 10. Developer platform — `/developer/*`

| ID | Feature |
|----|---------|
| DEV-01 | Add-on overview; **Launch embedded builder** (opens `/documents/prepare`). |
| DEV-02 | Usage cards — Requests · 24h (p95), Error rate, Active keys (revoked), Embed sessions · 24h. |
| DEV-03 | **API keys** (`?section=keys`) — Create key, secret shown once, empty state; embed snippet with Copy, **Allowed origins** and **Return URL** (save on blur); scopes `users:read`, `contacts:read`, `contacts:write`, `documents:read`, `documents:write`, `envelopes:send`, `audit:read`, `partner:manage`. |
| DEV-04 | **Endpoints** (`?section=endpoints`) — groups Workspace / Documents / Embedding, per-route method + path (e.g. `GET /api/v1/whoami`), Copy, parameters, example response. |
| DEV-05 | **Webhooks** (`?section=webhooks`) — Add endpoint dialog (Endpoint URL; Create disabled until valid), empty state. |
| DEV-06 | **Plan usage** (`?section=usage`) — signature requests, API calls, storage, SMS for the cycle. |
| DEV-07 | **Developer tools** (`?section=resources`) — Quickstart, API reference, API console, Embedding, Webhooks, Partner & reseller API, Migration guide. |
| DEV-08 | **API console** `/developer/sandbox` — Live / Test environment, method (GET/POST/PATCH/DELETE), endpoint list, query-parameter editor, code snippet (cURL / TypeScript / Python) with Copy, Response panel, Recent calls (last six) with Clear. |
| DEV-09 | **Guides & docs** `/developer/guides` — 14 guides in Getting started / Everyday use / Developers, Start product tour, Open API console. |
| DEV-10 | **Activity logs** `/developer/logs` — event stream (57 events), source filter (All, API, Webhooks, Auth, Billing, Signing, Admin), level filter (Info, Warn, Error), search, expandable rows. |
| DEV-11 | **Partner program** `/developer/partner` — application form: Company website, intended use, expected customers, contact name/e-mail, Send application. |

---

## 11. Support — `/support`

| ID | Feature |
|----|---------|
| SUP-01 | Summary — Your open tickets (escalated), Avg response (Enterprise SLA 1h), Resolved · 90d. |
| SUP-02 | New support ticket dialog — Subject, Category (Signing issue, Document preparation, API / integration, Billing & invoices, Security & compliance), Priority (P1 Urgent — signing blocked, P2 High, **P3 Normal default**, P4 Low), Related envelope, Description; SLA note. |
| SUP-03 | SLA routing by category + priority. |
| SUP-04 | Search tickets; Filter by status / priority; Sort (SLA risk, Recently updated, Newest, Oldest, Priority); **Export CSV**. |
| SUP-05 | Status chips (All, Open, Escalated, Pending, Resolved) and Needs-attention chips (Breached, Unassigned, P1 open). |
| SUP-06 | Ticket queue table (bulk select, Ticket details, Requester, Status, Priority, Assignee, Last update, Actions), empty state, pagination. |

---

## 12. Account & settings

### 12.1 Profile — `/account/profile`
- Profile photo (initials fallback, Add photo).
- Full name, e-mail ("Email verified <date>"), Time zone and Language (free-text, e.g. `Europe/London`, `en-GB`); Save changes enabled when dirty.
- Change password.
- **Colour mode** radiogroup: Match system / Light / Dark.
- **Signatures** — Add signature: Draw / Type / Upload, ink colours, stroke thickness, clear, adopt; empty state.

### 12.2 Login & security — `/account/security`
- E-mail, password **Change** (dialog: current password → Continue → new password).
- Two-factor authentication switch.
- Passkeys (Add passkey, empty state).
- Single sign-on (SAML) — Connect.
- Authenticated devices table (Device, Last seen, IP, Location) — **Sign out here**.
- **Remembered browsers** table (Browser, Last used, IP, Remembered until) — Forget, Forget all.

### 12.3 Notifications & email — `/account/notifications`
- 8 switches: delivered, viewed, signed, completes, declines, about to expire (on by default); reminder sent, weekly summary (off by default).
- Account e-mail; Additional recipients.

### 12.4 Integrations — `/account/integrations`
- Storage connectors Google Drive and Dropbox ("Not available on this deployment", Connect disabled).
- Recent exports table (Document, Connector, When, Written to, Status, Actions).

### 12.5 Organization & teams — `/account/organization`
- Organization card (name, seats, role).
- People table + **Invite member** dialog (Work email → Next).
- Teams (sharing boundary) + **Create team** dialog (Team name → Next).
- **Field palette admin** — choose which of the 16 field types the builder offers; Save palette.

### 12.6 Audit trail — `/account/audit`
- Search; event type filter (`document_created`, `document_uploaded`, `field_updated`, `recipient_added`, `routing_updated`); user filter; From/To dates.
- Sortable columns Event, User, Document, Time (+ Details, IP address); pagination.

### 12.7 Payments — `/account/payments`
- Connect Stripe (Business type: Company, Individual, Non-profit, Government entity).
- Payments received with status filter (All, Collected, Refunded, Failed, In flight).

### 12.8 Branding themes — `/account/brand`
- Plan gate on Free ("Branding is not included in the Free plan" → View plans); themes list; invitation preview; where a theme applies.

### 12.9 Billing & plan — `/account/billing`
- Summary cards: Seats, Next invoice, Billing cycle, Account balance.
- Plan card ("Free · Active") with **Change plan** (plan picker, seats, prorated today, next invoice, payment-method Change, Switch plan) and **Add seats**; upcoming invoice preview.
- Payment methods: **Add payment method** dialog — Card / bank (Stripe iframe, test mode) or Invoice / PO; Autopay switch.
- Balance activity; Billing details (Billing email, Tax ID (EIN), Billing cycle Monthly / Annual save 12%, save on blur).
- Recent charges; All invoices & receipts; invoices with status filter (All, Open, Paid, Past due).

### 12.10 Notifications centre — `/notifications`
- Search, time window (All time, 24 hours, 7/30/90 days), Mark all read, Clear read.
- Read-state chips (All, Unread, Read) and kind chips (Problems, Warnings, Completions, Updates).
- Table with bulk select (Notification, Kind, Received, Actions), empty state.

---

## 13. Cross-cutting capabilities

| Area | Detail |
|------|--------|
| Security | SHA-256 hashing, hash-chained audit trail, public verification page, MFA, passkeys, SAML SSO, device + remembered-browser control. |
| Compliance | ESIGN/UETA disclosure on every signing session; audit CSV export. |
| Payments | Stripe Connect for collecting from signers; Stripe test-mode card frame for the subscription. |
| Accessibility | Skip links, landmarks, labelled controls, keyboard field placement, chart data table. |
| Theming | Light/dark/system; branding themes (paid plans). |
| Limits | Free: 6 signature requests, 1,000 API calls, 100 MB, 20 SMS per cycle; 1 seat. |
| Integrations | REST API, webhooks, embed sessions, partner/reseller API, migration guide, storage connectors (disabled here). |

---

## 14. Observations from the walkthrough (candidate defects)

| # | Observation | Where | Severity (proposed) |
|---|-------------|-------|---------------------|
| O1 | Billing and invoice APIs sometimes time out under parallel load; page then shows "— Inactive", 0 seats and "no renewal scheduled". | `/account/billing` | S2 |
| O2 | Organization card shows **0 seats** while Overview and Billing show 1 seat activated. | `/account/organization` | S3 |
| O3 | Reports count 6 "Total sent invites" (100 % pending) and Overview shows "Action required 6" although no envelope has been sent — drafts are counted as invites. | `/reports`, `/overview` | S3 |
| O4 | Recipient row in the analytics table has an empty recipient name (recipient without e-mail). | `/reports` | S4 |
| O5 | Library shows status **Prepared** while the Documents report shows **Draft** for the same envelopes. | `/documents` vs `/reports?section=documents` | S4 |
| O6 | Change-plan dialog pre-selects **Enterprise** for a Free workspace. | `/account/billing` | S4 |
| O7 | Section heading reads "People1" (count not separated). | `/account/organization` | S4 |
| O8 | Trust-centre hero's accessible name reads "…how eSignProhandles your documents" (missing space at the line break). | `/trust` | S4 |
| O9 | Submitting an empty support ticket does nothing — no request, but also no validation message or field highlight. | `/support` → New ticket | S3 |
| O10 | **Create key** creates a live key immediately with no name, scope or confirmation step. | `/developer/api?section=keys` | S3 |
| O11 | Guests hitting an unknown route are sent to sign-in instead of seeing the 404 page. | any unknown route | S4 (by design?) |
| O12 | **Single active session per account.** A new sign-in anywhere signs every other session out (`/login?reason=superseded`, "Signed out on this device"). Product behaviour, not a defect, but parallel runs or a teammate's login break the saved session. | global | — (constraint) |
| O13 | Builder header says "N fields · autosaved" immediately, but the save request is sent ~0.7 s later (debounced). A reload inside that window shows the draft without the new field; it appears on a later load. | `/documents/{id}/prepare` | S4 |

Defects confirmed on 16 Nov 2026 and tracked with reproduction tests: see
[`TEST_CASES.md` §15](./TEST_CASES.md) (BUG-01…BUG-18).
