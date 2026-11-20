"""
Investigation results that the generator combines with the raw run data.

RUNS        archived runs (folders under reports-archive/) and their role
FAILURES    regex over "<file> :: <title> <tags>" → verdict for a FAILING test:
              class  "Application defect" | "Automation defect" | "Environment"
              bug    bug id when it is an application defect
            Every failing test must match one entry; unmatched ones show "Not yet triaged".
BUGS        the bug register (existing BUG-01…18 from src/helpers/bugs.ts + new ones)
INITIAL_IMPL / GAP_PRIORITY / GAP_ACTION   per-scenario overrides
"""

RUNS = [
    # label = archive folder suffix (npm run report:archive -- <label>); the newest matching folder is used.
    # Order matters: for the final Chromium state, later runs override earlier ones.
    {"label": "16 Nov 2026 full run (previous cycle)", "suffix": "_pre-baseline", "role": "historical"},
    {"label": "Baseline — existing suite, 17 Nov", "suffix": "_baseline", "role": "baseline"},
    {"label": "Re-run of baseline failures (2 workers)", "suffix": "_rerun-failed", "role": "rerun"},
    {"label": "New tests — first execution", "suffix": "_new-tests-run1", "role": "rerun"},
    {"label": "Performance (alone, 1 worker)", "suffix": "_perf", "role": "new"},
    {"label": "Cross-browser smoke (Firefox, WebKit, Pixel 7)", "suffix": "_xbrowser", "role": "xbrowser"},
    {"label": "Final regression — existing + new tests", "suffix": "_final-regression", "role": "final"},
    {"label": "Retest of tests hardened after the final run (18 Nov)", "suffix": "_final-retest", "role": "final"},
    {"label": "Cross-browser retest of hardened tests (18 Nov)", "suffix": "_xbrowser-retest", "role": "xbrowser"},
    {"label": "BUG-12 retest after fixing its false-pass test (18 Nov)", "suffix": "_bug12-retest", "role": "final"},
    {"label": "Gated session tests SESS-001…003 (RUN_SIGNOUT=true, run alone)", "suffix": "_signout", "role": "gated"},
]

# A failure whose error matches this is an environment/infrastructure problem (live site
# unreachable or the API timing out), not an application or automation defect → "Blocked".
ENV_ERROR = r"Test timeout of \d+ms exceeded|Page crashed|Target crashed|ERR_CONNECTION|ERR_TIMED_OUT|ECONNRESET|socket hang up|hCaptcha challenge|net::ERR|page\.goto: Timeout|reach the eSignPro API|reason=superseded"

_BUG_IDS = [f"BUG-{i:02d}" for i in range(1, 34)]
FAILURES = {
    # Known-bug reproductions: the test asserts the correct behaviour and fails while the bug exists.
    **{rf"\b{b}\b": {"class": "Application defect", "bug": b, "note": "Reproduction test still fails — defect open."} for b in _BUG_IDS},
    r"switches the reporting period": {"class": "Application defect", "bug": "BUG-28",
                                       "note": "WebKit only: period changes are ignored after the first one (fails only in the webkit project)."},
    r"UF-34 every report section": {"class": "Application defect", "bug": "BUG-28",
                                     "note": "WebKit only: after the period changes, report section tabs ignore clicks."},
    r"UF-19 sender places": {"class": "Application defect", "bug": "BUG-05",
                             "note": "Flow checkpoint for the placeholder (BUG-05) — strict mode asserts it; CI skips it with KNOWN_BUGS=expect-fail."},
    r"UF-14 UF-15 DOC-013": {"class": "Application defect", "bug": "BUG-29",
                             "note": "Flow checkpoint: Archive view has no Unarchive (BUG-29) - strict mode asserts it; CI skips it."},
    r"PERF-00[12]": {"class": "Application defect", "bug": "BUG-24", "note": "Cold page load exceeds budget; static assets ~1–1.8 s TTFB each from origin."},
    # Automation defects found and fixed this cycle (kept so baseline failures are classified).
    r"notifications bell opens a popover|validates that a ticket cannot be submitted empty|change-password dialog is labelled|"
    r"search with no matches shows a friendly empty state|account menu lists named items|theme toggle flips its label|"
    r"opens a new ticket with category|new-contact dialog is fully labelled|offers appearance, password and signature|"
    r"change password cannot continue|product tour starts|password fields are masked|add-seats dialog previews|"
    r"row actions menu returns focus|new-folder dialog is labelled|opens change plan and add seats|"
    r"UF-39 time zone|sidebar collapses and expands|SEC-010|opens the payment method dialog|exposes every module in the main navigation":
        {"class": "Automation defect", "bug": "",
         "note": "Click/typing landed before React hydration (TEST_PLAN R3) — dialog/menu never opened. Fixed with clickUntilVisible / committed-state retries."},
    r"shows signing controls in preview-only mode": {"class": "Automation defect", "bug": "",
         "note": "Below 1440 px Disclosure/Decline/Reassign live in 'More actions' (responsive design); test assumed desktop layout. Fixed."},
    r"landing page renders hero": {"class": "Automation defect", "bug": "",
         "note": "Phone header keeps 'Log in' in the hamburger menu; test picked the hidden desktop link. Fixed."},
    r"progress bar exposes numeric progress|before-you-send checklist items": {"class": "Environment", "bug": "",
         "note": "Builder page did not finish loading in time (60 s) during a backend slowdown; passed on re-run."},
    r"notification preferences expose switch state": {"class": "Environment", "bug": "",
         "note": "Preferences load client-side after hydration; exceeded 10 s under backend latency. Hydration guard + 25 s timeout added; passes 3/3."},
    r"SESS-003": {"class": "Automation defect", "bug": "", "note": "Reload raced the app's own redirect to /login (ERR_ABORTED). Fixed; passes."},
    r"group filters are offered|Payments fits a phone|Notifications centre stays readable|Contacts stays readable":
        {"class": "Environment", "bug": "", "note": "page.goto timed out / connection timed out to the live site; passed on re-run."},
}

ENV_CHROMIUM = "Chromium 1254 (Playwright 1.65), Windows 10, https://esignpro.net (production), Free-plan workspace"

# Severity follows TEST_PLAN §12: S1 Blocker, S2 Critical, S3 Major, S4 Minor.
BUGS = [
    {"id": "BUG-01", "module": "Prepare", "category": "Usability & Accessibility", "severity": "Major", "priority": "Medium",
     "description": "Field label/placeholder text is unreadable when the document page has a black background.",
     "steps": "1. Open the newest draft in the builder.\n2. Place a field on a page with a black background.\n3. Read the field label/placeholder.",
     "expected": "Field text keeps ≥ 3:1 contrast on light and dark pages.",
     "actual": "Label rgb(13,20,43) at 0.78 opacity on a 12 % green fill → 1.02:1 contrast on black.",
     "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026", "remarks": "Test: tests/bugs/reported-defects.spec.ts (PREP-019)."},
    {"id": "BUG-02", "module": "Prepare", "category": "Functional", "severity": "Minor", "priority": "Low",
     "description": "Favouriting a field does not move it to the top of the field palette.",
     "steps": "1. Open a draft in the builder.\n2. Favourite a field that is not a favourite (e.g. Checkbox).\n3. Look at the order in All fields.",
     "expected": "Favourited fields are listed before all non-favourites.",
     "actual": "Favourites stay in catalogue order.", "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026",
     "remarks": "PREP-020."},
    {"id": "BUG-03", "module": "Signer", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Preview cannot show how all recipients will see the document.",
     "steps": "1. Open a draft with recipients.\n2. Click Preview.\n3. Open 'Preview as'.",
     "expected": "An 'All recipients' view (or every recipient) with each recipient's fields.",
     "actual": "Only 'Preview as <one recipient>' links; no combined view.", "environment": ENV_CHROMIUM,
     "found": "Manual 16 Nov 2026", "remarks": "SIGN-008."},
    {"id": "BUG-04", "module": "Prepare", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Opening another document while one is open in the builder shows no warning.",
     "steps": "1. Open draft A in the builder.\n2. Use global search (Ctrl+K) to open draft B.",
     "expected": "Confirmation to close the current document; Cancel keeps it open.",
     "actual": "Document switches with no prompt.", "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026", "remarks": "PREP-021."},
    {"id": "BUG-05", "module": "Prepare", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Placeholder text set in the inspector is not shown on the editing canvas.",
     "steps": "1. Select a placed field.\n2. Inspector → Placeholder → type text.\n3. Look at the field on the canvas.",
     "expected": "Canvas field shows the placeholder.", "actual": "Canvas keeps showing the label (e.g. 'Signature').",
     "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026", "remarks": "PREP-022."},
    {"id": "BUG-06", "module": "Prepare", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Document-name character-limit error has raw validator wording and is not shown in the error colour.",
     "steps": "1. Open a draft.\n2. Rename it to 256+ characters and press Enter.",
     "expected": "'Document name must be 255 characters or fewer' in the error colour; name unchanged.",
     "actual": "'String should have at most 255 characters' in slate rgb(79,104,139).", "environment": ENV_CHROMIUM,
     "found": "Manual 16 Nov 2026", "remarks": "PREP-023. Same grey as BUG-15."},
    {"id": "BUG-07", "module": "Templates", "category": "Functional", "severity": "Critical", "priority": "High",
     "description": "Template names are not unique (Save and Rename both accept an existing name).",
     "steps": "1. Save a draft as template 'X'.\n2. Save another draft as template 'X' (or rename a template to 'X').",
     "expected": "Rejected with an 'already exists' error.", "actual": "Two templates with the same name accepted (TPL-D91881, TPL-FAD25C).",
     "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026",
     "remarks": "TPL-002. Not re-run this cycle: the test is @data (writes a template to production) — status carried from the 16 Nov evidence.",
     "status": "Confirmed"},
    {"id": "BUG-08", "module": "Workflow", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Missing recipient e-mail is shown as an amber advisory instead of a blocking error.",
     "steps": "1. Open a draft whose recipient has no e-mail.\n2. Go to Workflow → Before you send.",
     "expected": "Blocking error in the error colour, wording says the e-mail is required.",
     "actual": "'Recipients need an email' as amber advisory rgb(169,92,0).", "environment": ENV_CHROMIUM,
     "found": "Manual 16 Nov 2026", "remarks": "WF-011."},
    {"id": "BUG-09", "module": "Workflow", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Low",
     "description": "Recipients can be edited inline in the Workflow step as well as in Manage recipients.",
     "steps": "1. Open a draft → Workflow.\n2. Look at Recipients & signing order.",
     "expected": "Recipients read-only with a Manage recipients link.", "actual": "Inline e-mail and name editors.",
     "environment": ENV_CHROMIUM, "found": "Manual 16 Nov 2026", "remarks": "WF-012. Product decision."},
    {"id": "BUG-10", "module": "Templates", "category": "Functional", "severity": "Critical", "priority": "High",
     "description": "Delete (and Archive) on a template does nothing — no request, no confirmation, template stays.",
     "steps": "1. Documents → Templates.\n2. More actions on a test template → Delete.",
     "expected": "Template removed / moved to Trash after confirmation, with feedback.",
     "actual": "No request within 12 s; template stays.", "environment": ENV_CHROMIUM, "found": "Automation 16 Nov 2026", "remarks": "TPL-004."},
    {"id": "BUG-11", "module": "Support", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Submitting an empty support ticket gives no validation feedback.",
     "steps": "1. Support → New ticket.\n2. Click Submit ticket with empty fields.",
     "expected": "Required fields flagged with a message in the error colour.", "actual": "Nothing happens.",
     "environment": ENV_CHROMIUM, "found": "Walkthrough 13 Nov (O9)", "remarks": "SUP-004."},
    {"id": "BUG-12", "module": "Account", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Low",
     "description": "Organization section heading reads 'People1' (count glued to the label).",
     "steps": "1. Open /account/organization.", "expected": "'People' with the count separated.", "actual": "'People1'.",
     "environment": ENV_CHROMIUM, "found": "Walkthrough 13 Nov (O7)", "remarks": "ACC-014. Its test was a FALSE PASS since 16 Nov (read the headings before the count loaded); fixed 18 Nov, now reproduces."},
    {"id": "BUG-13", "module": "Public", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Low",
     "description": "Trust-centre hero accessible name reads 'eSignProhandles' (missing space).",
     "steps": "1. Open /trust.\n2. Read the h1 accessible name.", "expected": "'…eSignPro handles…'", "actual": "'…eSignProhandles…'",
     "environment": ENV_CHROMIUM, "found": "Walkthrough 13 Nov (O8)", "remarks": "AUTH-021."},
    {"id": "BUG-14", "module": "Billing", "category": "Functional", "severity": "Minor", "priority": "Low",
     "description": "Change-plan dialog pre-selects Enterprise for a Free workspace.",
     "steps": "1. /account/billing → Change plan.", "expected": "Current plan (Free) pre-selected.", "actual": "Enterprise $499.00 pre-selected.",
     "environment": ENV_CHROMIUM, "found": "Walkthrough 13 Nov (O6)", "remarks": "BIL-002."},
    {"id": "BUG-15", "module": "Auth", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Low",
     "description": "Registration validation error is shown in neutral grey, not the error colour.",
     "steps": "1. /register → Create account with an empty form.", "expected": "Message in the error colour.",
     "actual": "'Name and company are required' in rgb(79,104,139).", "environment": ENV_CHROMIUM,
     "found": "UI layer 16 Nov 2026", "remarks": "AUTH-004."},
    {"id": "BUG-16", "module": "Platform", "category": "Functional", "severity": "Minor", "priority": "Low",
     "description": "Intermittent React hydration error #418 (server/client text mismatch) on Activity logs / Trash.",
     "steps": "1. Open /developer/logs (recent events).\n2. Watch the console.", "expected": "No uncaught errors.",
     "actual": "Minified React error #418 on some loads; recorded as an annotation, not a failure.", "environment": ENV_CHROMIUM,
     "found": "UI layer 16 Nov 2026", "remarks": "NF-006. Intermittent: recorded as a test annotation, not a failure. Not observed this cycle. Likely timezone/relative-time rendering.",
     "status": "Confirmed"},
    {"id": "BUG-17", "module": "Contacts", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Saving a new contact without a name does nothing — no message, field not flagged.",
     "steps": "1. Contacts → New contact.\n2. Fill only Email.\n3. Save contact.", "expected": "Full name flagged as required.",
     "actual": "Dialog stays; no message.", "environment": ENV_CHROMIUM, "found": "UI layer 16 Nov 2026", "remarks": "CON-005."},
    {"id": "BUG-18", "module": "Developer", "category": "Functional", "severity": "Major", "priority": "Medium",
     "description": "Webhook 'Create endpoint' is enabled for a value that is not a URL.",
     "steps": "1. Developer → Webhooks → Add endpoint.\n2. Type 'not a url'.", "expected": "Create endpoint stays disabled.",
     "actual": "Enabled (never submitted by the test).", "environment": ENV_CHROMIUM, "found": "UI layer 16 Nov 2026", "status": "Closed",
     "remarks": "DEV-014. Closed 20 Nov 2026: the Developer platform (incl. webhooks UI) was removed from the product; test and scenario retired."},
]

ENV_NETWORK = "Chromium / Firefox / WebKit (Playwright 1.65), Windows 10, https://esignpro.net (production)"
BUGS += [
    {"id": "BUG-19", "module": "Platform", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Low", "new": True,
     "description": "Label in Name (WCAG 2.5.3): accessible names omit visible text on the logo link ('eSignPro home'), the global-search button (visible 'Ctrl K') and the account avatar (visible 'MS').",
     "steps": "1. Open /overview (or /login for the logo link).\n2. Run axe-core rule label-content-name-mismatch, or compare visible text with the accessible name.",
     "expected": "Each accessible name contains the control's visible text (speech-input users can say what they see).",
     "actual": "axe reports 'Text inside the element is not included in the accessible name' on 1–3 controls on every page (serious).",
     "environment": ENV_CHROMIUM, "found": "Coverage-gap tests 17 Nov 2026",
     "remarks": "A11Y-001/002 annotate it; dedicated test tests/a11y/accessibility.spec.ts (BUG-19). Fix: aria-label='Search documents, templates, contacts (Ctrl K)'; avatar name starting with the initials or aria-hidden initials."},
    {"id": "BUG-20", "module": "Platform", "category": "Usability & Accessibility", "severity": "Major", "priority": "Medium", "new": True,
     "description": "Reflow (WCAG 1.4.10): the sign-in page and the signed-in app shell are 360 px wide, so a 320 px viewport (400 % zoom on 1280 px) scrolls horizontally.",
     "steps": "1. Set the viewport to 320×640.\n2. Open /login, then /overview.\n3. Compare document scrollWidth with the viewport.",
     "expected": "No horizontal scrolling at 320 CSS px.", "actual": "360 px content in a 320 px viewport (auth canvas 'DIV.auth sf-canvas' = 360 px).",
     "environment": ENV_CHROMIUM, "found": "Coverage-gap tests 17 Nov 2026", "remarks": "A11Y-006, A11Y-008. Likely a min-width: 360px on the canvas/shell."},
    {"id": "BUG-21", "module": "Auth", "category": "Functional", "severity": "Minor", "priority": "Low", "new": True,
     "description": "Password meter labels passwords that break the stated rule ('Use 12+ characters with a number, capital and symbol') as 'Strong'.",
     "steps": "1. Open /register.\n2. Type 'Abcdefgh1!x' (11 chars).\n3. Type 14-char passwords missing a digit, a capital or a symbol.",
     "expected": "Non-compliant passwords keep the 'Use 12+ characters…' guidance (or a non-positive label); only compliant ones show 'Excellent — meets…'.",
     "actual": "All four show 'Strong'. 12-char compliant password shows 'Excellent — meets…'.",
     "environment": ENV_CHROMIUM, "found": "Coverage-gap tests 17 Nov 2026",
     "remarks": "AUTH-026/027. Server-side acceptance not tested (submitting would create a workspace); the test records whether the client attempts the submit. Confirm intended wording with Product."},
    {"id": "BUG-22", "module": "Transport", "category": "Security", "severity": "Minor", "priority": "Low", "new": True,
     "description": "Server software and version disclosed in HTTP response headers.",
     "steps": "1. curl -I https://esignpro.net/login", "expected": "No version in Server; no X-Powered-By.",
     "actual": "Server: nginx/1.24.0 (Ubuntu); X-Powered-By: Next.js.", "environment": ENV_NETWORK,
     "found": "Coverage-gap tests 17 Nov 2026", "remarks": "SEC-003. nginx: server_tokens off; Next.js: poweredByHeader: false. All other security headers (HSTS preload, CSP, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy) are present."},
    {"id": "BUG-23", "module": "Documents", "category": "Functional", "severity": "Major", "priority": "Medium", "new": True,
     "description": "Documents status filter 'Drafts' returns 0 documents while the 'Drafts' view lists all 6 prepared drafts.",
     "steps": "1. /documents → Drafts view: 6 documents.\n2. /documents → Filters → Status = Drafts (URL ?status=draft).",
     "expected": "The Drafts filter lists the same 6 envelopes as the Drafts view.", "actual": "'0 documents' and 'Nothing in Documents' (3/3 attempts).",
     "environment": ENV_CHROMIUM, "found": "Coverage-gap tests 17 Nov 2026",
     "remarks": "DOC-004. Probably the filter matches status 'draft' while these envelopes are 'prepared' (cf. FEATURES O5: library 'Prepared' vs report 'Draft')."},
    {"id": "BUG-24", "module": "Platform", "category": "Performance", "severity": "Major", "priority": "High", "new": True,
     "description": "Slow first visit: immutable static JS chunks are served from the origin (nginx, no CDN) with ~1.0–1.8 s time-to-first-byte each; cold page loads take 6–15 s.",
     "steps": "1. Fresh browser profile (empty cache).\n2. Open /, /pricing, /overview, /documents, /contacts, /account/billing.\n3. Read Navigation Timing; time a 6 KB chunk with curl.",
     "expected": "TTFB ≤ 1.5 s, DOMContentLoaded ≤ 3 s, load ≤ 5 s on a cold cache; static assets from a CDN/edge cache.",
     "actual": "6–7 of 8 pages over budget per run (e.g. load 11.3 s on /, 11.2 s /contacts, DCL 7.5 s /pricing, TTFB 2.1 s /account/billing). A 6 KB chunk: TTFB 1.0–1.8 s (connect 0.25 s); Stripe's CDN served 290 KB in 0.13–0.6 s on the same network. Warm-cache loads ~1.8–2.2 s. HTTP/2 in use.",
     "environment": ENV_CHROMIUM + " — measured from the test machine (South Asia); repeat from the main user region to size the impact.",
     "found": "Coverage-gap tests 17 Nov 2026", "status": "Confirmed",
     "remarks": "PERF-001/002. INTERMITTENT, load-dependent: 6/8 pages over budget (17 Nov), 7/8 (19 Nov 15:13 UTC), 0/8 (19 Nov 15:53 UTC). Not fixed — the origin still serves static assets with ~1 s TTFB. Recommend a CDN for /_next/static."},
]

# Scenarios whose state before this cycle differs from "New test ⇒ not implemented".
BUGS += [
    {"id": "BUG-25", "module": "Billing", "category": "Functional", "severity": "Major", "priority": "High", "new": True, "status": "New",
     "description": "Upgrading Free to Team invoiced the full month ($12.00) although the change-plan preview promised 'Prorated today $9.99'; the billing anchor moved from 13 Dec to 18 Dec.",
     "steps": "1. Free workspace with a test card on file.\n2. Billing > Change plan > Team: preview shows Prorated today $9.99, Next invoice $12.00.\n3. Switch plan > Stripe Checkout (full month, BDT 1,553.95 = $12.00) > Subscribe.\n4. Open the invoice list.",
     "expected": "Charged the previewed prorated amount ($9.99) with the renewal date unchanged, or the preview states the full price.",
     "actual": "Invoice QQHAP1JG-0001 (18 Nov 2026, Paid): 1 x Team (at $12.00 / month) = $12.00; renews 18 Dec 2026.",
     "environment": ENV_CHROMIUM + " - Stripe TEST mode", "found": "Payment tests 18 Nov 2026",
     "remarks": "Stripe Checkout also defaults to the visitor's local currency (BDT) while the app quotes USD."},
    {"id": "BUG-26", "module": "Billing", "category": "Usability & Accessibility", "severity": "Minor", "priority": "Medium", "new": True, "status": "New",
     "description": "Change-plan dialog says 'Applies immediately with proration' for every choice, but a downgrade is only scheduled for the end of the period.",
     "steps": "1. On Team, Billing > Change plan.\n2. Pick Free.",
     "expected": "Copy says the downgrade starts at renewal (as the preview's 'Starts 18 Dec 2026' does).",
     "actual": "Subtitle 'Applies immediately with proration' next to 'Starts 18 Dec 2026 - Due today: Nothing - you keep Team until then'.",
     "environment": ENV_CHROMIUM, "found": "Payment tests 18 Nov 2026", "remarks": "The confirm button reads 'Schedule switch' for downgrades."},
    {"id": "BUG-27", "module": "Billing", "category": "Functional", "severity": "Minor", "priority": "Medium", "new": True, "status": "New",
     "description": "'Recent charges' says 'No charges yet - the first invoice has not been collected' while the invoice list shows a Paid $12.00 invoice.",
     "steps": "1. After a paid upgrade, open /account/billing.\n2. Compare Recent charges with the invoice list.",
     "expected": "The collected $12.00 payment is listed under Recent charges.",
     "actual": "Recent charges is empty; invoice QQHAP1JG-0001 is Paid $12.00.",
     "environment": ENV_CHROMIUM + " - Stripe TEST mode", "found": "Payment tests 18 Nov 2026", "remarks": ""},
    {"id": "BUG-28", "module": "Reports", "category": "Compatibility", "severity": "Major", "priority": "High", "new": True,
     "description": "WebKit (Safari engine): once the report period has been changed, the Reports page ignores further period changes and every section-tab click (links are correct, e.g. /reports?section=templates&range=12m). Chromium and Firefox work.",
     "steps": "1. In Safari/WebKit open /reports.\n2. Change the period to Last 12 months (URL gets ?range=12m).\n3. Click By document / By template / By recipient.",
     "expected": "The clicked section opens, as before the period was changed and as in Chromium/Firefox.",
     "actual": "Standalone WebKit: 5/5 section tabs do nothing after the change; a second period change was ignored 2/2 (URL stays ?range=12m); the first change itself failed 1 of 3 tries. Before any change the tabs work.",
     "environment": "WebKit 26 (Playwright 1.65, Desktop Safari profile), Windows 10, https://esignpro.net — confirm on a real Safari/macOS",
     "found": "Cross-browser run 18 Nov 2026", "remarks": "Reproduction: tests/reports/reports.spec.ts (BUG-28, @smoke, runs cross-browser)."},
    {"id": 'BUG-29', "module": 'Documents', "category": 'Functional', "severity": 'Minor', "priority": 'Medium', "new": True, "status": "New",
     "description": "Archive view offers no 'Unarchive': the row menu still says 'Archive', and choosing it silently unarchives the document (no confirmation).",
     "steps": "1. Documents > More actions > Archive > confirm ('You can unarchive it from there').\n2. Open the Archive folder > More actions on the document.",
     "expected": "An 'Unarchive' (or 'Restore') item that returns the document to the library.",
     "actual": "Menu identical to the library ('Archive', 'Delete' ...). Clicking 'Archive' removes the document from Archive (archived_at -> null) without any dialog.",
     "environment": ENV_CHROMIUM + " (Team plan)", "found": "Coverage-gap tests 20 Nov 2026", "remarks": 'Reproduction: tests/flows/library-lifecycle.flow.spec.ts (BUG-29, @data).'},
    {"id": 'BUG-30', "module": 'Documents', "category": 'Functional', "severity": 'Major', "priority": 'High', "new": True, "status": "New",
     "description": "Trash has no Restore: neither the row menu nor the bulk bar can bring a deleted document back, although 'Move to Trash' says 'You can restore it from there'. Delete in Trash erases permanently.",
     "steps": '1. Documents > More actions > Delete > Move to Trash.\n2. Open Trash > More actions; or select the row and look at the bulk bar.',
     "expected": "A 'Restore' action that returns the document to the library.",
     "actual": "Row menu: Open, Copy link, Add fields, Make template, Download, Print, Move to folder, Duplicate, Rename, Archive, Delete. Bulk bar: Move, Archive, Download, Delete. 'Delete' = 'Delete this document permanently?'.",
     "environment": ENV_CHROMIUM + " (Team plan)", "found": "Coverage-gap tests 20 Nov 2026", "remarks": "Reproduction: tests/flows/library-lifecycle.flow.spec.ts (BUG-30, read-only). Whether 'Move' restores is untested."},
    {"id": 'BUG-31', "module": 'Contacts', "category": 'Usability & Accessibility', "severity": 'Minor', "priority": 'Medium', "new": True, "status": "New",
     "description": "Contact 'Add as recipient' adds the contact to whichever draft was edited last, without asking; the ~2 s notice names no envelope and miscounts ('added as recipient 4' for the 2nd recipient).",
     "steps": "1. Contacts > open a contact > Add as recipient.\n2. Read the notice; check the drafts' recipients.",
     "expected": 'The user picks the envelope (or is taken to it) and the confirmation names it.',
     "actual": "POST /contacts/add-as-recipients; contact appended to the most recently updated draft; notice 'QA Contact ... added as recipient 4 - assign fields in the builder' disappears after ~2 s.",
     "environment": ENV_CHROMIUM + " (Team plan)", "found": "Coverage-gap tests 20 Nov 2026", "remarks": 'Reproduction: tests/contacts/add-as-recipient.spec.ts (BUG-31, @data, removes the recipient again).'},
    {"id": 'BUG-32', "module": 'Documents', "category": 'Functional', "severity": 'Minor', "priority": 'Low', "new": True, "status": "New",
     "description": "Folder names are not unique: 'New folder' creates a second folder with an existing name. Folders cannot be renamed or deleted in the UI, so duplicates stay.",
     "steps": '1. Documents > New folder > enter the name of an existing folder > Create.',
     "expected": "Inline error ('A folder with this name already exists'); nothing created.",
     "actual": 'A second folder with the same name appears in the Folders list.',
     "environment": ENV_CHROMIUM + " (Team plan)", "found": "Coverage-gap tests 20 Nov 2026", "remarks": "Reproduction: tests/flows/library-lifecycle.flow.spec.ts (BUG-32, fixed name 'QA Folder (uniqueness check)')."},
    {"id": 'BUG-33', "module": 'Overview', "category": 'Functional', "severity": 'Minor', "priority": 'Low', "new": True, "status": "New",
     "description": "'Envelope volume - last 12 weeks' skips a week: rows are W34, W35, W36, W38 ... W46 (W37 missing, W34 extra).",
     "steps": "1. Open /overview.\n2. Read the 'Envelopes created per week' table.",
     "expected": 'Twelve consecutive ISO weeks ending with the latest week (W35 ... W46).',
     "actual": 'W34, W35, W36, W38, W39, W40, W41, W42, W43, W44, W45, W46.',
     "environment": ENV_CHROMIUM + " (Team plan)", "found": "Coverage-gap tests 20 Nov 2026", "remarks": 'Reproduction: tests/overview/overview.spec.ts (BUG-33, read-only). Likely a week-numbering error in the bucket labels.'},
]

INITIAL_IMPL = {
    "DOC-002": "P",   # views were presence-only
    "DOC-006": "P",   # sort only checked the select value
    "NAV-008": "M",   # mobile drawer was manual
    "UF-07": "M",
    "UF-14": "P",
    "AUTH-019": "M",
    "DOC-012": "M",
    "ACC-002": "I",
    "COMP-011": "N",
    "COMP-012": "P",
    "AUTH-008": "B", "AUTH-012": "P", "UF-02": "B", "UF-03": "P", "UF-05": "P", "DOC-009": "B", "PREP-002": "B",
    "DOC-022": "N", "UF-12": "B", "BIL-004": "P", "BIL-007": "P", "INT-008": "B", "UF-46": "B", "BIL-012": "N",
}

GAP_PRIORITY = {
    "WF-010": "Critical", "SIGN-006": "Critical", "UF-26": "Critical", "UF-28": "Critical", "SIGN-003": "Critical",
    "SEC-020": "Critical", "SEC-021": "Critical", "ACC-007": "Critical", "AUTH-008": "Critical",
    "PERF-006": "High", "PERF-007": "High", "SEC-024": "High", "INT-011": "High", "INT-012": "High",
}

GAP_ACTION = {
    "WF-010": "Provision a staging workspace (or reset quota) with a controlled recipient mailbox; automate send → sign → certificate.",
    "SIGN-006": "Same staging setup as WF-010; assert certificate, signed PDF and hash-chained audit entries.",
    "SEC-020": "Add a second seat/role on staging; assert member cannot reach admin routes or API.",
    "SEC-021": "Use a disposable account on staging; verify lockout/throttling after N failed sign-ins.",
    "PERF-006": "Run JMeter/k6 against staging at expected peak (agree N users and SLA first).",
    "PERF-007": "Stress/peak test on staging; record error rate and recovery time.",
    "SEC-024": "OWASP ZAP baseline + dependency (SCA) scan on staging, with written authorization.",
    "UNIT-001": "Developers to add unit tests in the application repo (Jest/Vitest/pytest); share coverage report with QA.",
}
for _uid in range(1, 13):
    GAP_ACTION.setdefault(f"UNIT-{_uid:03d}", GAP_ACTION["UNIT-001"])
    GAP_PRIORITY.setdefault(f"UNIT-{_uid:03d}", "Medium")
