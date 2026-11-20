# eSignPro — User Flow Catalogue

| Field | Value |
|-------|-------|
| Product | eSignPro (`https://esignpro.net`) |
| Document version | 1.0 — 16 Nov 2026 |
| Companion docs | [`FEATURES.md`](./FEATURES.md) (what exists) · [`TEST_PLAN.md`](./TEST_PLAN.md) (how we test) · [`TEST_CASES.md`](./TEST_CASES.md) (atomic cases) |
| Automation | `tests/flows/*.flow.spec.ts` (journeys) · `tests/ui/*.ui.spec.ts` (module UI) · `tests/bugs/*` (defect reproductions) |

## Why this document exists

The module specs check that each screen *renders* and that its controls *exist*. The
defects found manually on 16 Nov 2026 (BUG-01…BUG-10, see `TEST_CASES.md` §15) sat in
the gaps **between** those checks: what happens when a user *uses* a control and then
looks at the result somewhere else. Examples:

| Defect | Control existed (covered) | Outcome a user sees (was not covered) |
|--------|---------------------------|----------------------------------------|
| BUG-02 | favourite toggle present | favourite moves to the top |
| BUG-03 | Preview link present | every recipient's view can be checked |
| BUG-04 | global search opens docs | current document is protected |
| BUG-05 | Placeholder input present | placeholder appears on the canvas |
| BUG-06/08 | errors appear | wording and colour are right |
| BUG-07/10 | Save as template, Delete present | names stay unique; delete deletes |

A flow below is a full journey with its **checkpoints**: the things a real user would notice.
Every checkpoint is either automated or listed as manual with a reason. A new feature is
not done until its flow is added here.

**Legend.** Auto: ✔ automated · ◐ partly automated · M manual · ⛔ blocked (needs a real
mailbox, quota, payment or an IdP). Spec paths are relative to `tests/`.

---

## A. Guest & account access

| ID | Flow | Steps | Checkpoints (must all hold) | Negative / edge branches | Auto |
|----|------|-------|-----------------------------|--------------------------|------|
| UF-01 | Discover → choose a plan | `/` → Pricing → plan CTA | Hero, plans and FAQ render; plan CTA lands on `/register?plan=…&cycle=…` with the plan kept | Narrow screen; dark scheme | ✔ `flows/guest.flow` |
| UF-02 | Sign up → verify → first visit | `/register` → fill → Create account → OTP → `/overview` | Strength meter reacts; terms required; OTP page names the e-mail; Overview greets new workspace; tour offered | Empty submit (error colour), weak password, terms unchecked, duplicate e-mail, wrong/expired OTP, resend | ◐ `auth/signup`, `ui/auth.ui` · ⛔ OTP mailbox |
| UF-03 | Sign in | `/login` → e-mail + password → (OTP) → `/overview` | Trusted device skips OTP; error for wrong credentials in error colour; no session on failure | Empty submit, wrong password, locked account, SSO tenant redirect | ✔ `auth/login`, `ui/auth.ui` |
| UF-04 | Forgot password | `/login/forgot` → e-mail → link → new password → sign in | Same response for known/unknown e-mail; link single-use, 30 min | Expired link, reused link, weak new password | M (mailbox) |
| UF-05 | Deep link as guest | Open `/contacts` signed-out → sign in | Redirect to `/login?next=/contacts`; after sign-in user lands on `/contacts` | Unknown route as guest (O11); signing in elsewhere signs this session out (O12) | ✔ `flows/guest.flow` (opt-in `RUN_LOGIN_FLOW=true`, run alone) |
| UF-06 | Verify a signed document | `/verify` → upload PDF | Hash match/mismatch result; certificate details | Tampered file, non-PDF | ◐ page only |
| UF-07 | Sign out / session expiry | Account menu → Sign out; or expired cookie | Back button does not reopen app; protected routes redirect with `next` | Multiple tabs | M |

## B. Application shell

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-08 | Find anything | `Ctrl/Cmd+K` → type ≥ 2 chars → pick a result | Focus in search; grouped results; Enter opens item; Escape closes and restores focus | < 2 chars hint; no results; **opening a document while another is open must warn (BUG-04)** | ✔ `ui/navigation.ui`, `bugs/reported-defects` |
| UF-09 | Notifications | Bell → See all → filter → mark read | Popover, unread count, read state persists | Empty centre | ◐ `account/settings` |
| UF-10 | Product tour | Menu → Start tour → Next…/Skip | Step counter; Skip closes; not shown again | — | ✔ `navigation` |
| UF-11 | Personalise | Theme toggle, collapse sidebar | Label flips; preference persists; readable in dark | Mobile drawer | ✔ `ui/navigation.ui` |

## C. Documents library

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-12 | Upload → draft | Upload & prepare → file → builder | Draft created, builder opens, quota decrements | Unsupported/oversized file; quota exhausted (402 with upgrade guidance) | ⛔ quota (`@quota`) |
| UF-13 | Start from a template | Templates → Use template / Form catalog → add | Envelope created with template fields | Empty catalog search | ◐ catalog dialog |
| UF-14 | Organise | Search → filter → sort → new folder → move → favourite → archive → trash → restore | Counts update; views reflect moves; empty states friendly | Duplicate/blank folder name; impossible filter | ◐ `documents/*`, `ui/documents.ui` |
| UF-15 | Row actions | More actions → Open, Copy link, Duplicate, Rename, Download, Print, Make template, Delete | Each action has a visible effect and feedback; **Delete really deletes (BUG-10 for templates)** | Copy link disabled for drafts | ◐ menu inventory · ✔ BUG-10 |
| UF-16 | Library → builder → back | Open draft → builder → Save and close | Returns to library; draft listed with right status | Browser back | ✔ `flows/library.flow` |

## D. Envelope preparation (builder)

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-17 | Manage recipients | Manage recipients → add / from contacts → role → order → Save and Continue | Recipient cards update (role, field count); **one place to edit recipients (BUG-09)** | **Missing e-mail → blocking error in the error colour (BUG-08)**; invalid e-mail; duplicate recipient; remove recipient with fields | ✔ `flows/envelope-preparation.flow`, `bugs/*` |
| UF-18 | Find and favourite fields | Palette search → favourite → Favourites tab | Search filters; **favourites move to the top (BUG-02)**; Favourites tab lists exactly them | No search match | ✔ `ui/prepare.ui`, `bugs/*` |
| UF-19 | Place & configure a field | Drag or Enter on tile → inspector: label, placeholder, recipient, required, validation, condition | Counter increments; autosaved; **placeholder visible on canvas (BUG-05)**; **text readable on any page colour (BUG-01)**; rules persist after reload | Undo/redo; delete; overlapping fields; keyboard-only placement | ✔ `flows/envelope-preparation.flow`, `bugs/*` |
| UF-20 | Pages | Add / insert / reorder / delete page | Thumbnails and fields follow pages | Delete last page disabled | ◐ controls only |
| UF-21 | Rename document | Click title → type → Enter | Title updates in header and library; **over-limit name rejected with clear wording in error colour (BUG-06)** | Blank name, whitespace, 255+ chars, Escape cancels | ✔ `flows/envelope-preparation.flow`, `bugs/*` |
| UF-22 | Preview as recipients | Preview → Preview as … → Back to editing | Each recipient sees only their fields; **all recipients can be reviewed (BUG-03)**; preview saves nothing | Recipient with 0 fields | ✔ `flows/envelope-preparation.flow`, `bugs/*` |
| UF-23 | Save as template | Save as template → name → Save | Template in Templates with fields; **name must be unique (BUG-07)** | Blank name; rename to an existing name | ✔ `bugs/*` (`@data`) |
| UF-24 | Leave / switch document | Open another doc (search, sidebar) or Save and close | **Warning before closing the current document (BUG-04)**; autosave state kept | Unsaved inspector edit | ✔ `bugs/*` |

## E. Workflow & sending

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-25 | Configure delivery | Workflow → routing → invite text → reminders → expiry → branding | Invite preview updates live; selections persist after reload; simulation timeline matches | Reset to template; payment without Stripe (blocked with guidance) | ◐ `documents/builder-details`, `ui/workflow.ui` |
| UF-26 | Pre-send check & send | Before you send → fix items → Send envelope | Checklist marks blockers as **errors**, not advisories (BUG-08); nothing sent while blocked; status → Waiting for others; audit entry | Quota exhausted; no fields; no recipients | ◐ blocked states · ⛔ send (quota + mailbox) |
| UF-27 | Track & manage | Library → status → remind / void / expire | Status, reminders, expiry follow settings | Void after partial signing | ⛔ |

## F. Signing (recipient side)

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-28 | Sign | Invite link → disclosure consent → fill fields → adopt signature → Finish | Required fields enforced; progress bar; certificate + signed PDF; sender notified | Expired link; already signed; mobile | ◐ preview controls · ⛔ live |
| UF-29 | Decline / reassign | Decline with reason / Reassign to e-mail | Sender notified; audit entry; original cannot sign | Reassign to self | ⛔ |
| UF-30 | In-person signing | Host hands device to signer | Signer identity captured | — | ⛔ |
| UF-31 | Pay while signing | Payment field → card → Finish | Payment recorded in Payments | Card declined | ⛔ Stripe Connect |

## G. Contacts

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-32 | Build address book | New contact → save → search → open → edit | Detail page opens; row listed; search finds it; edit persists | **Blank name must be flagged (BUG-17)**, invalid / duplicate e-mail, XSS text | ✔ `flows/contacts.flow` (`@data`), `contacts`, `ui/contacts.ui` |
| UF-33 | Contact → envelope | Contact → Send envelope / Add as recipient | Recipient prefilled with name, e-mail, role | Contact without e-mail | M |

## H. Reports

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-34 | Analyse activity | Range → sections → custom report → export | Every section loads for every range; numbers agree with library (O3/O5); no NaN/empty names | Empty period | ✔ `flows/reports.flow`, `reports/*`, `ui/reports.ui` |

## I. Developer platform — retired

Removed from the product on 20 Nov 2026 (sidebar entry gone; `/developer/*` redirects to the overview or shows "That page isn't here"). Tests and scenarios retired; the backend `/api/proxy/webhooks*` endpoints still answer and stay covered by the API contract tests. UF-35…UF-37 retired.

## J. Support

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-38 | Raise and track a ticket | New ticket → fill → Submit → queue → filter/sort/export | Ticket listed with SLA; counters update | **Empty submit must explain what is missing (BUG-11 / O9)** | ◐ `support/*`, `ui/support.ui` (create is manual) |

## K. Account & organisation

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-39 | Profile | Edit time zone → Save → reload → revert | Save enabled only when dirty; value persists | Invalid time zone | ✔ `flows/account.flow` |
| UF-40 | Signature | Add signature → draw/type/upload → adopt | Shown in list; offered when signing | Empty drawing | ◐ dialog |
| UF-41 | Security | Change password; 2FA; passkey; forget device | Re-auth enforced; old password rejected | Wrong current password; weak new | ◐ validation |
| UF-42 | Organisation | Invite member; create team; field palette admin | Invite sent; palette change reflected in builder | Empty e-mail; seat limit | ◐ validation |
| UF-43 | Audit | Filter by event/user/date | Rows match filter; export | Empty range | ◐ page |
| UF-44 | Payments & branding | Connect Stripe; create theme | Plan gate on Free; preview reflects theme | — | ◐ gates |

## L. Billing

| ID | Flow | Steps | Checkpoints | Negative / edge | Auto |
|----|------|-------|-------------|-----------------|------|
| UF-45 | Review and change plan | Billing → Change plan → pick plan → preview → cancel | Current plan pre-selected (**BUG-14 / O6**); price preview; nothing applied on cancel | No card; trial terms | ✔ `flows/billing.flow`, `ui/billing.ui` |
| UF-46 | Seats & payment method | Add seats → preview; Add payment method → Stripe form | Proration shown; card validation | Declined card | ◐ `@payment` |

## M. Cross-cutting

| ID | Flow | Checkpoints | Auto |
|----|------|-------------|------|
| UF-47 | Phone-width journey | Every module page at 390 px: no horizontal scroll, heading visible | ✔ `ui/*` (baseline) |
| UF-48 | Dark-mode journey | Headings and field text readable in dark scheme | ✔ `ui/*` (baseline), BUG-01 |
| UF-49 | Keyboard-only envelope | Skip link → palette → Enter places field → inspector | ◐ `ui/navigation.ui`, `documents/prepare` |
| UF-50 | Error & outage | API timeout banner + Retry; no raw values (NaN/undefined); no uncaught JS errors | ✔ `ui/*` (baseline) |

---

## Coverage summary

| Area | Flows | ✔ | ◐ | M | ⛔ |
|------|------:|--:|--:|--:|--:|
| Guest & access | 7 | 2 | 2 | 2 | 1 (shared) |
| Shell | 4 | 3 | 1 | 0 | 0 |
| Documents | 5 | 1 | 3 | 0 | 1 |
| Builder | 8 | 7 | 1 | 0 | 0 |
| Workflow & sending | 3 | 0 | 2 | 0 | 1 |
| Signing | 4 | 0 | 1 | 0 | 3 |
| Contacts | 2 | 1 | 0 | 1 | 0 |
| Reports | 1 | 1 | 0 | 0 | 0 |
| Support | 1 | 0 | 1 | 0 | 0 |
| Account | 6 | 1 | 5 | 0 | 0 |
| Billing | 2 | 1 | 1 | 0 | 0 |
| Cross-cutting | 4 | 3 | 1 | 0 | 0 |
| **Total** | **50** | **21** | **19** | **4** | **6** |

⛔ flows need one of: a recipient mailbox (Gmail IMAP / test inbox), monthly quota
(resets 13 Dec 2026, or a fresh workspace), Stripe Connect test account. See
`TEST_PLAN.md` §16 for how to unblock them.

## How to add a flow

1. Add a row here (ID, steps, **checkpoints a user would notice**, negative branches).
2. Automate it in `tests/flows/<area>.flow.spec.ts` using `test.step()` per step, with
   `expect.soft` for checkpoints so one broken checkpoint does not hide the next.
3. If a checkpoint reveals a defect, add it to `src/helpers/bugs.ts` and a reproduction
   to `tests/bugs/`. It then appears on the dashboard's **Known bugs** tab.
4. Reference the flow ID in the test title (`UF-19 …`) so the dashboard search finds it.
