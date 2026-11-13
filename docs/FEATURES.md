# eSignPro — Feature Inventory

> Live walkthrough of **https://esignpro.net** performed on **13 Nov 2026** with the test
> workspace **Global Softel** (`mokaddes.arman.2111+esignTest@gmail.com`, plan: Free).
> Every route below was opened in the authenticated app; anything marked *(inferred)* was
> not exercised end-to-end and is covered by exploratory/manual testing.

---

## 1. Public site & authentication

| ID | Feature | Route | Notes |
|----|---------|-------|-------|
| PUB-01 | Marketing landing page | `/` | Hero, benefits, pricing teaser, feature grid, trust badges, footer. |
| PUB-02 | Pricing & plans | `/#pricing` | Free / Team ($12/seat) / Business ($28/seat) / Enterprise ($499). |
| PUB-03 | Trust & compliance page | `/trust` | Certifications, status, security posture. |
| PUB-04 | Log in | `/login` | Work email + password, show/hide password, **Remember this device**, forgot password. |
| PUB-05 | Forgot password | `/login/forgot` | Request reset link *(inferred)*. |
| PUB-06 | Create account | `/register` | Full name, company, work email, password + strength meter (12+ chars, number, capital, symbol), company type, company size, Terms & disclosure checkbox. |
| PUB-07 | Identity verification | `/login/verify` | 6-digit e-mailed OTP, resend, 10-minute expiry. Codes are sent by e-mail; no SMS path. |
| PUB-08 | Tabbed auth | `/login`, `/register` | Sign in ↔ Create account tabs; deep links keep state. |
| PUB-09 | Enterprise SSO redirect | `/login` | Notice that enterprise tenants may redirect to their IdP. |
| PUB-10 | 404 page | any unknown route | "That page isn't here" with recovery links. |
| PUB-11 | Dark / light theme | global | Toggle in the header; preference is persisted (also on Profile → Appearance). |
| PUB-12 | Responsive layout | global | Collapsible sidebar, mobile drawer, touch-friendly signing. |

**Free-plan limit observed:** 6 signature requests per month. Drafts count against the
quota once created; the sidebar widget shows usage (e.g. `6 / 6 · 100%`).

---

## 2. Application shell

| ID | Feature | Notes |
|----|---------|-------|
| SHELL-01 | Collapsible sidebar | Create, Home, Documents, Contacts, Reports, Developer, Support, My account, contextual sub-navigation (folders, account pages, developer sections). |
| SHELL-02 | Plan usage widget | "Free" plan, signature requests used this month, % link to billing. |
| SHELL-03 | Global search | `Ctrl/Cmd + K`; searches documents, templates, contacts and members; requires ≥ 2 characters. |
| SHELL-04 | Notifications | Header bell + `/notifications` centre. |
| SHELL-05 | Account & help menu | My account, Notifications, Start product tour, Support centre, Contact support, Guides & docs, API console, Sign out. |
| SHELL-06 | Product tour | Guided in-app tour launched from the account menu or dashboard. |
| SHELL-07 | Status/toast region | `role=status` announcements for saves and errors; useful automation anchors. |
| SHELL-08 | Accessibility | Skip-to-content link, landmark roles, keyboard placement of fields, ARIA labels, accessible chart table. |

---

## 3. Overview dashboard — `/overview`

| ID | Feature |
|----|---------|
| OVR-01 | Tenant-admin workspace summary: plan, renewal date, attention count. |
| OVR-02 | KPI cards: Action required, Out for signature, Envelopes (90 days), Seats activated, Completion rate. |
| OVR-03 | "Start from a template" — most-used templates, Browse all templates, empty state. |
| OVR-04 | Envelope volume chart (last 12 weeks) with keyboard-readable data table. |
| OVR-05 | "Needs your attention" list with actionable items (e.g. every licensed seat in use). |
| OVR-06 | "Spend this cycle" — invoiced total, autopay state, Billing & plan / View invoices. |
| OVR-07 | "Team activity" — who is sending, last active, sent count. |
| OVR-08 | Primary actions: Take the tour, New envelope (routes to `/documents/prepare`). |

---

## 4. Documents library — `/documents`

### 4.1 Folders & smart views

- **Folders:** All documents, Templates, Archive, Trash.
- **Views:** Waiting for me (inbox), Waiting for others (outbox), Drafts, Completed,
  Expiring soon, Favourites, Shared with me, Owned by me.
- **Templates:** dedicated folder with **Browse form catalog** (ready-made forms) and
  upload/prepare actions.

### 4.2 Toolbar & list

| ID | Feature |
|----|---------|
| DOC-01 | Full-text search across title, recipient, template, contact. |
| DOC-02 | Filters — status (all, action required, waiting for others, completed, drafts, voided), type (agreements, NDAs, order forms, HR documents), time (all, 7/30 days, quarter, custom range), owner (all, me, my team, shared with me). |
| DOC-03 | Sort — Recent, Name, Status, Owner. |
| DOC-04 | New folder dialog with name validation. |
| DOC-05 | Upload & prepare (native file chooser: PDF, images, Office, OpenDocument, text) and drag-and-drop upload. |
| DOC-06 | Document rows — title, envelope ID (`ENV-…`), page count, status, signer count, updated time, row actions ("Prepare and send"). |
| DOC-07 | Server-side pagination / result count ("Showing 1 of 1 document"). |
| DOC-08 | Status lifecycle: Draft → Prepared → Waiting for others → Completed / Declined / Voided / Expired; Archive and Trash transitions. |
| DOC-09 | Favourites and sharing (Shared with me / Owned by me views). |
| DOC-10 | Empty states per folder and filter combination. |

---

## 5. Envelope preparation builder — `/documents/{id}/prepare`

| ID | Feature |
|----|---------|
| PREP-01 | Rename document inline; autosave indicator ("N fields · autosaved"). |
| PREP-02 | Two-step header: **1 Prepare** → **2 Workflow**; Send for signature; Download PDF (current state); Save as template; Save and close; Preview (signer view). |
| PREP-03 | Recipients panel — Add recipient, Manage recipients (add / rename / reorder / remove), role per recipient: **Needs to sign, Approver, Receives a copy, In-person signer**, live status and field count. |
| PREP-04 | Field palette with search and favourites: Signature, Initials, Date and Time, Date Signed, Full Name, Email, Text Input, Checkbox, Radio Group, Dropdown, Stamp, Attachment, Number, Text Box, Pen/Drawing, Payment. |
| PREP-05 | Drag-and-drop placement **or** keyboard placement (focus a field, press Enter → centred on page). |
| PREP-06 | Pages panel — thumbnails, add / insert / reorder / delete pages. |
| PREP-07 | Inspector — field label, required flag, validation rules, conditional logic, help text; duplicate, copy to every page, align/distribute, snap to grid, zoom/fit, undo/redo. |
| PREP-08 | Per-field assignment to a recipient and required/optional state. |
| PREP-09 | Attachment and payment fields placed on the document. |
| PREP-10 | Template reuse — save current envelope as a reusable template. |

---

## 6. Signing workflow — `/documents/{id}/workflow`

| ID | Feature |
|----|---------|
| WF-01 | Routing mode: **Sequential** or **Parallel**. |
| WF-02 | Recipients & signing order — add recipient, roles, reorder, reset to template. |
| WF-03 | Invite e-mail — subject, message, merge tokens, live **Invite preview**. |
| WF-04 | Payment request — Stripe, **Single payer / Split equally / Custom split**, save payment request, place payment field. |
| WF-05 | "Before you send" checklist — valid e-mails, fields assigned, disclosure accepted, certificate available. |
| WF-06 | Reminders — none / every 24h / every 48h / every 7 days; expiration window. |
| WF-07 | Branding — choose or manage themes (logo, colours). |
| WF-08 | Delivery simulation — preview the recipient delivery experience. |
| WF-09 | Save (draft) / Send envelope / Back to prepare. |

---

## 7. Signer experience — `/documents/{id}/signer-view`

| ID | Feature |
|----|---------|
| SIGN-01 | Desktop / Mobile preview toggle. |
| SIGN-02 | Start signing, complete required fields, progress indicator. |
| SIGN-03 | Electronic-records **Disclosure** acknowledgement. |
| SIGN-04 | Decline and Reassign actions. |
| SIGN-05 | Finish signing; unsigned-PDF download; preview-only banner (nothing saved). |
| SIGN-06 | Adopted signature / initials are offered to the signer. |

---

## 8. Contacts — `/contacts`

| ID | Feature |
|----|---------|
| CON-01 | Address book columns: Contact, Company, Group, Source, Last signed, Envelopes. |
| CON-02 | New contact dialog — full name (required), company, email (required, validated), job title, default role (Needs to sign / Approver / Receives a copy / In-person signer), group (Customers / Internal / Counsel / Vendors). |
| CON-03 | Contact detail page — tabs **Documents** and **Contact details**; Send envelope, Add as recipient, Edit contact. |
| CON-04 | Details: e-mail (mailto), phone, company, job title, address, description, default role, group, source, owner. |
| CON-05 | Activity: envelope count and last-signed date. |
| CON-06 | Contacts are exposed over `GET /v1/contacts` and can be injected into embed sessions. |
| CON-07 | Search and empty states. |

---

## 9. Reports & analytics — `/reports`

| ID | Feature |
|----|---------|
| REP-01 | "My Analytics" scorecard (completion rate, volume, turnaround). |
| REP-02 | Date range — Last 7 days, Last 30 days, Last quarter, Last 12 months. |
| REP-03 | Export report. |
| REP-04 | Sections: My analytics, All reports, By document, By template, By recipient, Custom report. |
| REP-05 | Invite performance table — Recipient, Created, Sent, Pending, Completed, Cancelled, Declined, Rate. |
| REP-06 | Empty states and totals per section. |

---

## 10. Developer platform — `/developer/api`

| ID | Feature |
|----|---------|
| DEV-01 | Add-on overview — expose users, contacts and documents over REST; **Launch embedded builder**. |
| DEV-02 | Usage metrics — requests/24h, p95 latency, error rate, active keys, embed sessions. |
| DEV-03 | **API keys** — create, roll, revoke; secret shown once; scopes: `users:read`, `contacts:read`, `contacts:write`, `documents:read`, `documents:write`, `envelopes:send`, `audit:read`, `partner:manage`. |
| DEV-04 | **Endpoints** — REST reference with schemas. |
| DEV-05 | **Webhooks** — signature verification, retry schedule, delivery logs. |
| DEV-06 | **Plan usage** — API add-on entitlements. |
| DEV-07 | **Developer tools** — sandbox/console, guides. |
| DEV-08 | **API console** — `/developer/sandbox`, compose a call against the live workspace, Send request. |
| DEV-09 | **Guides & docs** — `/developer/guides`: Quickstart, API reference, Embedding guide, Webhooks, Partner & reseller API, Migration guide. |
| DEV-10 | **Activity logs** — `/developer/logs` (34 events in the test workspace), filters and pagination. |
| DEV-11 | **Become a partner** — `/developer/partner` partner/reseller provisioning. |

---

## 11. Support — `/support`

| ID | Feature |
|----|---------|
| SUP-01 | Ticket counters — All, Open, Escalated, Pending, Resolved, Breached, Unassigned, P1 open. |
| SUP-02 | New ticket — Subject, Category (Signing issue / Document preparation / API / integration / Billing & invoices / Security & compliance), Priority (P1 Urgent → P4 Low), Related envelope, Description. |
| SUP-03 | SLA routing by category + priority. |
| SUP-04 | Filters — status, priority; sort by SLA risk, recently updated, newest, oldest, priority. |
| SUP-05 | Empty state and server-side pagination. |
| SUP-06 | Support centre, Contact support, Guides & docs shortcuts. |

---

## 12. Account & settings

### 12.1 Profile — `/account/profile`
- Profile photo (initials fallback, add/change photo).
- Full name, e-mail (verified badge + timestamp), time zone, language; Save changes enabled when dirty.
- Change password.
- **Appearance** — Colour mode: Match system / Light / Dark (radiogroup, saved to account, applies on every device).
- **Signatures** — Add signature: Draw / Type / Upload tabs, black/blue ink, stroke thickness slider, clear, smoothing, adopt; default signature offered first; empty state.

### 12.2 Login & security — `/account/security`
- Change password.
- Two-factor authentication (connect/enable).
- Passkeys (add, list, empty state).
- Single sign-on (SAML).
- Authenticated devices & browsers — sign out here, forget one device, forget all.

### 12.3 Notifications & e-mail — `/account/notifications`
- Per-event channels for: document delivered, recipient views, recipient signs, document completes, recipient declines, about to expire, reminder sent, weekly activity summary.

### 12.4 Integrations — `/account/integrations`
- Integration catalogue, connect/disconnect, status.

### 12.5 Organization & teams — `/account/organization`
- Members, roles (admin), invitations, teams, seat management.

### 12.6 Audit trail — `/account/audit`
- Server-side search/filter by event type, user, date range.
- Columns: Event, User, Details, Document, IP address, Time; pagination; empty state.

### 12.7 Payments — `/account/payments`
- Payment methods, transactions/receipts.

### 12.8 Branding themes — `/account/brand`
- Custom themes (logo, colours) applied to invitations and signing pages.

### 12.9 Billing & plan — `/account/billing`
- Current plan card (Free), renewal date, usage.
- **Change plan** dialog: Free $0, Team $12/seat, Business $28/seat, Enterprise $499; seats stepper; prorated-today and next-invoice preview; payment-method warning; **Start 30-day Enterprise free trial**; Switch plan.
- **Add seats** dialog; billing e-mail; billing cycle; **Add payment method**; invoices & receipts table with "All invoices & receipts".

### 12.10 Notifications centre — `/notifications`
- In-app notification list, read state, filters, bulk mark-as-read *(inferred)*.

---

## 13. Cross-cutting capabilities

| Area | Detail |
|------|--------|
| Security | SHA-256 document hashing, hash-chained audit trail, tamper-evident certificates, MFA, passkeys, SAML SSO, device session control. |
| Compliance | Electronic-records disclosure/consent on every signing session; audit trail export *(inferred)*. |
| Payments | Stripe (card fingerprint cookies observed), payer selection, split payments. |
| Accessibility | Skip links, semantic landmarks, ARIA-labelled controls, keyboard field placement, chart data table. |
| Theming | Light/dark/system, account-level theme, branding themes for recipients. |
| Limits | Free plan: 6 signature requests/month, 1 seat; API add-on is a separate entitlement. |
| Integrations | REST API, webhooks, embed sessions, partner/reseller API, migration tooling. |
