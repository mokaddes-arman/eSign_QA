"""
Builds the consolidated QA workbooks from REAL run results.

Inputs (never edited by hand):
  qa-reports/catalog.py      unique required scenarios + implementation verdicts
  qa-reports/triage.py       investigation verdict for each failing test + bug list
  reports-archive/<run>/dashboard-report/index.html   per-test results of every run
      (written by reporters/dashboard-reporter.ts; archived by npm run report:archive)

Outputs (qa-reports/):
  QA_Coverage_Matrix.xlsx  QA_Gap_Analysis.xlsx  QA_Execution_Summary.xlsx  QA_Bug_Report.xlsx
  metrics.json  (numbers quoted in QA_Summary.md)

Usage:  python -I qa-reports/generate_reports.py
Run definitions live in RUNS below; add a row after each archived run.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalog import CATEGORIES, load  # noqa: E402
import triage  # noqa: E402

ARCHIVE = ROOT / "reports-archive"
OUT = ROOT / "qa-reports"

# --------------------------------------------------------------------------- runs
# role: historical | baseline | new | xbrowser | final | gated
RUNS = list(triage.RUNS)
QUIET = "--quiet" in sys.argv

CHROMIUM = {"chromium", "chromium-builder", "chromium-account"}
SUPPORT_PROJECTS = {"session-restore"}  # teardown, not a test case


def load_run(folder: str):
    html = (ARCHIVE / folder / "dashboard-report" / "index.html").read_text(encoding="utf-8")
    m = re.search(r"window\.__DASHBOARD__ = (\{.*?\});\s*\n", html, re.S)
    if not m:
        raise SystemExit(f"no dashboard payload in {folder}")
    return json.loads(m.group(1))


def key_of(t):
    file = t["file"].replace("\\", "/").removeprefix("tests/")
    # Leaf titles repeat across describe blocks (e.g. one per viewport), so the stable
    # Playwright test id (hash of file + title path + project) keeps every test distinct.
    tags = " ".join("@" + tag.lstrip("@") for tag in (t.get("tags") or []))  # dashboard stores "smoke", not "@smoke"
    return f"{file} :: {t['title']} {tags} #{t['id']}"


def evidence(run_folder, t):
    base = f"reports-archive/{run_folder}/dashboard-report/"
    out = {}
    for kind in ("trace", "screenshot", "video"):
        if t.get(kind):
            out[kind] = base + t[kind]
    out["report"] = f"reports-archive/{run_folder}/playwright-report/index.html#?testId={t['id']}"
    return out


def resolve(run):
    """Newest archive folder ending with the run's suffix (folders start with the ISO run date)."""
    matches = sorted(p.name for p in ARCHIVE.iterdir() if p.is_dir() and p.name.endswith(run["suffix"]))
    return matches[-1] if matches else None


# Every run archived automatically after a test run (qa-reports-reporter → "_auto")
# is included in date order, after the curated runs, so the LATEST result always wins.
_curated = {resolve(r) for r in RUNS}
for folder in sorted(p.name for p in ARCHIVE.iterdir() if p.is_dir() and p.name.endswith("_auto")):
    if folder not in _curated:
        RUNS.append({"label": f"Automatic run {folder[:19].replace('T', ' ')}", "suffix": folder, "role": "auto"})

runs = []
for r in RUNS:
    folder = resolve(r)
    if not folder:
        if r.get("optional"):
            continue
        raise SystemExit(f"missing archived run for {r['label']} (*{r['suffix']})")
    r = {**r, "folder": folder}
    data = load_run(r["folder"])
    tests = []
    for t in data["tests"]:
        if t["project"] in SUPPORT_PROJECTS:
            continue
        t = dict(t)
        t["key"] = key_of(t)
        t["evidence"] = evidence(r["folder"], t)
        tests.append(t)
    runs.append({**r, "data": data, "tests": tests})


def tests_for(role, projects=None):
    """Latest result per (project, key) across all runs with this role (later runs win)."""
    latest = {}
    for run in runs:
        if run["role"] != role:
            continue
        for t in run["tests"]:
            if projects and t["project"] not in projects:
                continue
            latest[(t["project"], t["key"])] = (run, t)
    return list(latest.values())


# Final chromium state = baseline results overlaid by later runs (new tests, final regression).
def chromium_state(roles):
    state = {}
    for run in runs:
        if run["role"] not in roles:
            continue
        for t in run["tests"]:
            if t["project"] in CHROMIUM:
                state[t["key"]] = (run, t)
    return state


INITIAL = chromium_state({"baseline"})
FINAL = chromium_state({"baseline", "new", "final", "gated", "auto"})
XB = {p: {t["key"]: (run, t) for run in runs if run["role"] in ("xbrowser", "auto") for t in run["tests"] if t["project"] == p}
      for p in ("firefox", "webkit", "mobile-chrome")}

SPECIAL = {
    "REG-001": ("chromium", "@smoke"),
    "REG-002": ("chromium", "*"),
    "REG-004": ("xbrowser", "@smoke"),
    "COMP-005": ("firefox", "@smoke"),
    "COMP-006": ("webkit", "@smoke"),
    "COMP-007": ("mobile-chrome", "@smoke"),
}


def matched(row, state):
    if row["id"] in SPECIAL:
        scope, tag = SPECIAL[row["id"]]
        if scope == "chromium":
            pool = state
        elif scope == "xbrowser":
            pool = {f"{p}|{k}": v for p, d in XB.items() for k, v in d.items()}
        else:
            pool = XB.get(scope, {})
        return [v for k, v in pool.items() if tag == "*" or tag in k]
    if not row["match"]:
        return []
    rx = re.compile(row["match"])
    return [v for k, v in state.items() if rx.search(k)]


def verdict_for(t):
    """Triage verdict of a failing test (application / automation / environment)."""
    if "Precondition failed" in (first_line(t.get("error")) or ""):
        return {"class": "Test data", "bug": "", "note": first_line(t.get("error"))}
    if re.search(triage.ENV_ERROR, first_line(t.get("error")) or ""):
        return {"class": "Environment", "bug": "", "note": "Live site unreachable / API timeout during the run (environment, not a product defect)."}
    for pattern, v in triage.FAILURES.items():
        if re.search(pattern, t["key"]):
            return v
    return {"class": "Not yet triaged", "bug": "", "note": ""}


def first_line(err):
    if not err:
        return ""
    msg = err.get("message") if isinstance(err, dict) else str(err)
    msg = re.sub(r"\x1b\[[0-9;]*m", "", msg or "")
    return re.sub(r"\s+", " ", msg).strip()[:220]


def execution(row, state, impl):
    hits = matched(row, state)
    if not hits:
        return ("Blocked" if impl == "B" else "Not Executed"), hits
    statuses = Counter(t["status"] for _, t in hits)
    if statuses.get("failed"):
        # A failure caused only by the environment is reported as Blocked, not Failed.
        app_or_auto = [t for _, t in hits if t["status"] == "failed" and verdict_for(t)["class"] not in ("Environment", "Test data")]
        return ("Failed" if app_or_auto else "Blocked"), hits
    if statuses.get("passed") or statuses.get("flaky"):
        return "Passed", hits
    return ("Blocked" if impl == "B" else "Skipped"), hits


def coverage(impl, status):
    if impl == "I" and status in ("Passed", "Failed"):
        return "Fully Covered"
    if impl in ("I", "P"):
        return "Partially Covered"
    return "Not Covered"


IMPL_LABEL = {"I": "Implemented", "P": "Partially Implemented", "N": "Not Implemented", "M": "Not Implemented", "B": "Not Implemented"}
IMPL_NOTE = {"M": "Manual-only scenario", "B": "Blocked by dependency", "N": "Automatable — no test yet"}

scenarios = load()


def initial_impl(row):
    if row["id"] in triage.INITIAL_IMPL:
        return triage.INITIAL_IMPL[row["id"]]
    return "N" if row["remarks"].startswith("New") else row["impl"]


def assess(row, state, impl):
    status, hits = execution(row, state, impl)
    counts = Counter(t["status"] for _, t in hits)
    failed = [(run, t) for run, t in hits if t["status"] == "failed"]
    actual = ", ".join(f"{n} {s}" for s, n in sorted(counts.items())) or "—"
    if failed:
        actual += " · " + first_line(failed[0][1].get("error"))
    ev = failed[0][1]["evidence"] if failed else {}
    verdicts = sorted({verdict_for(t)["class"] + (f" ({verdict_for(t)['bug']})" if verdict_for(t)["bug"] else "") for _, t in failed})
    tests = sorted({re.sub(r"( @\S+)*\s*#\S+$", "", t["key"]).strip() for _, t in hits})
    return {
        "impl": impl,
        "impl_label": IMPL_LABEL[impl],
        "status": status,
        "coverage": coverage(impl, status),
        "actual": actual,
        "tests": "\n".join(tests[:6]) + (f"\n… +{len(tests) - 6} more" if len(tests) > 6 else ""),
        "n_tests": len(tests),
        "trace": ev.get("trace", ""),
        "screenshot": ev.get("screenshot", ""),
        "report": ev.get("report", ""),
        "verdict": "; ".join(verdicts),
        "bugs": sorted({verdict_for(t)["bug"] for _, t in failed if verdict_for(t)["bug"]}),
    }


for s in scenarios:
    s["initial"] = assess(s, INITIAL, initial_impl(s))
    s["final"] = assess(s, FINAL, s["impl"])
    s["category_name"] = CATEGORIES[s["category"]]

# --------------------------------------------------------------------------- metrics


def metrics(rows, phase):
    c = Counter()
    for r in rows:
        a = r[phase]
        c["required"] += 1
        c[{"I": "implemented", "P": "partial"}.get(a["impl"], "missing")] += 1
        c[a["status"]] += 1
        c[a["coverage"]] += 1
        if a["impl"] in "MB":
            c["manual" if a["impl"] == "M" else "blocked_dep"] += 1
    executed = c["Passed"] + c["Failed"]
    req = c["required"] or 1
    return {
        "required": c["required"], "implemented": c["implemented"], "partial": c["partial"], "missing": c["missing"],
        "manual_only": c["manual"], "blocked_dependency": c["blocked_dep"],
        "executed": executed, "passed": c["Passed"], "failed": c["Failed"], "skipped": c["Skipped"],
        "blocked": c["Blocked"], "not_executed": c["Not Executed"],
        "fully_covered": c["Fully Covered"], "partially_covered": c["Partially Covered"], "not_covered": c["Not Covered"],
        "implementation_coverage": round(100 * c["implemented"] / req, 1),
        "implementation_incl_partial": round(100 * (c["implemented"] + c["partial"]) / req, 1),
        "execution_coverage": round(100 * executed / req, 1),
        "passing_coverage": round(100 * c["Passed"] / req, 1),
        "execution_pass_rate": round(100 * c["Passed"] / executed, 1) if executed else 0.0,
    }


by_cat = defaultdict(list)
for s in scenarios:
    by_cat[s["category"]].append(s)

LATEST_RUN = max(r["data"]["runDate"] for r in runs)
M = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "latest_run": LATEST_RUN, "overall": {}, "categories": {}}
for phase in ("initial", "final"):
    M["overall"][phase] = metrics(scenarios, phase)
    for cat, rows in by_cat.items():
        M["categories"].setdefault(cat, {})[phase] = metrics(rows, phase)

# Test-level totals per run (what the existing reports show).
M["runs"] = []
for run in runs:
    t = run["data"]["totals"]
    M["runs"].append({"label": run["label"], "role": run["role"], "date": run["data"]["runDate"], "folder": run["folder"],
                      "total": t["total"], "passed": t["passed"], "failed": t["failed"], "flaky": t.get("flaky", 0),
                      "skipped": t["skipped"], "pass_rate": round(100 * run["data"]["passRate"], 1),
                      "projects": ", ".join(sorted({x["project"] for x in run["tests"]}))})

# Per-test comparison: historical (16 Nov) vs baseline vs final.
hist = {t["key"]: t["status"] for run in runs if run["role"] == "historical" for t in run["tests"] if t["project"] in CHROMIUM}
base = {k: t["status"] for k, (_, t) in INITIAL.items()}
fin = {k: t["status"] for k, (_, t) in FINAL.items()}
M["test_counts"] = {
    "existing_tests_in_baseline": len(base),
    "baseline": dict(Counter(base.values())),
    "final_chromium_tests": len(fin),
    "final": dict(Counter(fin.values())),
    "new_tests": len([k for k in fin if k not in base]),
    "new_tests_status": dict(Counter(v for k, v in fin.items() if k not in base)),
}
changes = []
for k in sorted(set(hist) | set(base) | set(fin)):
    h, b, f = hist.get(k, "—"), base.get(k, "—"), fin.get(k, "—")
    if len({h, b, f} - {"—"}) > 1 or (h == "—" and b != "—"):
        changes.append((k, h, b, f))
M["changed_tests"] = len(changes)

# --------------------------------------------------------------------------- styling
HEAD = PatternFill("solid", fgColor="1F3864")
FILL = {
    "Passed": "C6EFCE", "Fully Covered": "C6EFCE", "Implemented": "C6EFCE",
    "Failed": "FFC7CE", "Not Covered": "FFC7CE", "Not Implemented": "FFC7CE",
    "Skipped": "FFEB9C", "Partially Covered": "FFEB9C", "Partially Implemented": "FFEB9C",
    "Blocked": "D9D9D9", "Not Executed": "EDEDED",
    "Critical": "FF8B8B", "High": "FFC7CE", "Medium": "FFEB9C", "Low": "DDEBF7",
    "Confirmed": "FFC7CE", "New": "FFC7CE", "Resolved": "C6EFCE",
}


def sheet(wb, title, headers, rows, widths=None, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title[:31]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = HEAD
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    for row in rows:
        ws.append(row)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            v = cell.value if isinstance(cell.value, str) else None
            if v in FILL:
                cell.fill = PatternFill("solid", fgColor=FILL[v])
    for i, w in enumerate(widths or [18] * len(headers), start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "B2"
    if rows:
        ws.auto_filter.ref = ws.dimensions
    return ws


def kv_sheet(wb, title, pairs, first=False):
    ws = sheet(wb, title, ["Metric", "Value"], pairs, [52, 70], first=first)
    ws.freeze_panes = None
    return ws


# --------------------------------------------------------------------------- 1. coverage matrix
MATRIX_HEAD = ["Scenario ID", "Module", "Testing Category", "Testing Scenario", "Existing Test Case ID",
               "Test File / Test Name", "Implementation Status", "Execution Status", "Coverage Status",
               "Expected Result", "Actual Result", "Failure Investigation", "Trace / Evidence", "Remarks",
               "Initial Implementation", "Initial Execution", "Initial Coverage"]
MATRIX_W = [12, 13, 20, 44, 14, 52, 16, 13, 15, 34, 46, 26, 40, 40, 16, 13, 15]


def matrix_row(s):
    f, i = s["final"], s["initial"]
    legacy = s["id"] if re.match(r"^(AUTH|NAV|OVR|DOC|TPL|PREP|WF|SIGN|CON|REP|DEV|SUP|ACC|BIL|NF|UF)-", s["id"]) else ""
    ev = "\n".join(x for x in (f["trace"] and "trace: " + f["trace"], f["screenshot"] and "screenshot: " + f["screenshot"],
                               f["report"] and "report: " + f["report"]) if x)
    remark = s["remarks"]
    if s["impl"] in IMPL_NOTE:
        remark = f"{IMPL_NOTE[s['impl']]}. {remark}".strip()
    return [s["id"], s["module"], s["category_name"], s["scenario"], legacy, f["tests"] or "—", f["impl_label"],
            f["status"], f["coverage"], s["expected"], f["actual"], f["verdict"], ev, remark,
            i["impl_label"], i["status"], i["coverage"]]


wb = Workbook()
ov = []
for cat, name in CATEGORIES.items():
    a, b = M["categories"][cat]["initial"], M["categories"][cat]["final"]
    ov.append([name, b["required"], b["implemented"], b["partial"], b["missing"], b["executed"], b["passed"], b["failed"],
               b["skipped"], b["blocked"], b["not_executed"], b["fully_covered"], b["partially_covered"], b["not_covered"],
               f"{a['implementation_coverage']}%", f"{b['implementation_coverage']}%", f"{b['execution_coverage']}%",
               f"{b['passing_coverage']}%", f"{b['execution_pass_rate']}%"])
o = M["overall"]
ov.append(["TOTAL", o["final"]["required"], o["final"]["implemented"], o["final"]["partial"], o["final"]["missing"],
           o["final"]["executed"], o["final"]["passed"], o["final"]["failed"], o["final"]["skipped"], o["final"]["blocked"],
           o["final"]["not_executed"], o["final"]["fully_covered"], o["final"]["partially_covered"], o["final"]["not_covered"],
           f"{o['initial']['implementation_coverage']}%", f"{o['final']['implementation_coverage']}%",
           f"{o['final']['execution_coverage']}%", f"{o['final']['passing_coverage']}%", f"{o['final']['execution_pass_rate']}%"])
ws = sheet(wb, "Overall Coverage",
           ["Category", "Required", "Implemented", "Partially Impl.", "Missing", "Executed", "Passed", "Failed", "Skipped",
            "Blocked", "Not Executed", "Fully Covered", "Partially Covered", "Not Covered", "Impl. Coverage (initial)",
            "Impl. Coverage (final)", "Execution Coverage", "Passing Coverage", "Execution Pass Rate"],
           ov, [30] + [12] * 18, first=True)
for cell in ws[ws.max_row]:
    cell.font = Font(bold=True)
ws.append([])
ws.append(["Definitions: Implementation coverage = implemented ÷ required; Execution coverage = executed (passed + failed) ÷ required; "
           "Passing coverage = passed ÷ required; Execution pass rate = passed ÷ executed. Denominator = unique required scenarios. "
           "'Implemented' counts only tests that assert the outcome; presence-only tests are 'Partially Implemented'. "
           "Execution status comes only from archived run results (see QA_Execution_Summary 'Runs')."])
ws.append([f"Generated {M['generated']} · latest test run {M['latest_run']} (regenerated automatically after every run)"])
for cat, name in CATEGORIES.items():
    sheet(wb, name.replace(" Testing", "").replace("Usability & Accessibility", "Usability & A11y") + " Testing"
          if cat == "UX" else name, MATRIX_HEAD, [matrix_row(s) for s in by_cat[cat]], MATRIX_W)
sheet(wb, "All Scenarios", MATRIX_HEAD, [matrix_row(s) for s in scenarios], MATRIX_W)
wb.save(OUT / "QA_Coverage_Matrix.xlsx")

# --------------------------------------------------------------------------- 2. gap analysis


def gap_type(s):
    f, text = s["final"], (s["scenario"] + " " + s["expected"] + " " + s["remarks"]).lower()
    if s["category"] == "COMP":
        return "Missing browser/device coverage"
    if s["impl"] in "NMB":
        if re.search(r"permission|role|access|idor|admin", text):
            return "Missing permission check"
        if re.search(r"invalid|reject|wrong|blank|duplicate|declin|blocked without|negative|error", text):
            return "Missing negative scenario"
        if re.search(r"boundary|limit|255|pagination|empty period|oversized", text):
            return "Missing edge case"
        return "Missing scenario"
    if s["impl"] == "P":
        if re.search(r"validation|required|rules", text):
            return "Missing validation check"
        return "Partially covered scenario"
    if f["status"] in ("Not Executed", "Skipped", "Blocked"):
        return "Unexecuted scenario"
    return ""


def gap_priority(s):
    if s["id"] in triage.GAP_PRIORITY:
        return triage.GAP_PRIORITY[s["id"]]
    if s["category"] == "SEC" or re.search(r"payment|password|session|golden|send envelope|sign\b|certificate", s["scenario"].lower()):
        return "High"
    if s["category"] in ("E2E", "INT", "PERF") and s["impl"] in "NB":
        return "High"
    if s["category"] in ("UX", "COMP") and s["impl"] == "P":
        return "Low"
    return "Medium"


def gap_action(s):
    if s["id"] in triage.GAP_ACTION:
        return triage.GAP_ACTION[s["id"]]
    return {
        "N": "Automate with the existing POM (read-only where possible; @data tag for writes, run on staging).",
        "M": "Keep as a manual charter; record the result in the execution log each release.",
        "B": "Unblock the dependency (see remarks) or provide a staging environment, then automate.",
        "P": "Strengthen: drive the control and assert the outcome/persistence, not only presence.",
        "I": "Execute in the next run (currently not executed/skipped).",
    }[s["impl"]]


gaps = [s for s in scenarios if gap_type(s)]
order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
gaps.sort(key=lambda s: (order[gap_priority(s)], s["category"], s["id"]))
gap_rows = [[s["id"], s["category_name"], s["module"], s["scenario"], gap_type(s), s["final"]["impl_label"],
             s["final"]["status"], s["final"]["coverage"], gap_priority(s), gap_action(s), s["remarks"]] for s in gaps]
GAP_HEAD = ["Scenario ID", "Testing Category", "Module", "Scenario", "Gap Type", "Implementation Status", "Execution Status",
            "Coverage Status", "Priority", "Recommended Action", "Dependency / Remarks"]
GAP_W = [12, 22, 13, 46, 26, 16, 13, 15, 10, 52, 46]
wb = Workbook()
summary = Counter((gap_type(s), gap_priority(s)) for s in gaps)
types = sorted({t for t, _ in summary})
sheet(wb, "Summary", ["Gap Type", "Critical", "High", "Medium", "Low", "Total"],
      [[t] + [summary[(t, p)] for p in order] + [sum(summary[(t, p)] for p in order)] for t in types]
      + [["TOTAL"] + [sum(summary[(t, p)] for t in types) for p in order] + [len(gaps)]]
      + [[], [f"Generated {M['generated']} · latest test run {M['latest_run']}"]], [34, 10, 10, 10, 10, 10], first=True)
sheet(wb, "All Gaps", GAP_HEAD, gap_rows, GAP_W)
for t in types:
    sheet(wb, t.replace("/", "-")[:31], GAP_HEAD, [r for r in gap_rows if r[4] == t], GAP_W)
closed = [s for s in scenarios if s["initial"]["coverage"] != "Fully Covered" and s["final"]["coverage"] == "Fully Covered"]
sheet(wb, "Gaps Closed This Cycle", ["Scenario ID", "Testing Category", "Scenario", "Initial", "Now", "Test"],
      [[s["id"], s["category_name"], s["scenario"], f"{s['initial']['impl_label']} / {s['initial']['status']}",
        f"{s['final']['impl_label']} / {s['final']['status']}", s["final"]["tests"]] for s in closed], [12, 22, 46, 30, 30, 52])
wb.save(OUT / "QA_Gap_Analysis.xlsx")
M["gaps"] = {"total": len(gaps), "by_priority": dict(Counter(gap_priority(s) for s in gaps)),
             "by_type": dict(Counter(gap_type(s) for s in gaps)), "closed_this_cycle": len(closed)}

# --------------------------------------------------------------------------- 3. execution summary
wb = Workbook()
fo, io = M["overall"]["final"], M["overall"]["initial"]
kv_sheet(wb, "Summary", [
    ["Report generated (UTC)", M["generated"]],
    ["Latest test run (UTC)", M["latest_run"]],
    ["Target environment", "https://esignpro.net (live production deployment)"],
    ["Total required scenarios (unique)", fo["required"]],
    ["Implemented scenarios (asserting outcome)", f"{fo['implemented']}  (initially {io['implemented']})"],
    ["Partially implemented scenarios", f"{fo['partial']}  (initially {io['partial']})"],
    ["Missing scenarios (not implemented)", f"{fo['missing']}  (of which manual-only {fo['manual_only']}, blocked by dependency {fo['blocked_dependency']})"],
    ["Executed scenarios (passed + failed)", fo["executed"]],
    ["Passed", fo["passed"]], ["Failed", fo["failed"]], ["Skipped", fo["skipped"]], ["Blocked", fo["blocked"]],
    ["Not executed", fo["not_executed"]],
    ["Implementation coverage", f"{fo['implementation_coverage']}%  (initially {io['implementation_coverage']}%; incl. partial {fo['implementation_incl_partial']}%)"],
    ["Execution coverage", f"{fo['execution_coverage']}%  (initially {io['execution_coverage']}%)"],
    ["Passing coverage", f"{fo['passing_coverage']}%  (initially {io['passing_coverage']}%)"],
    ["Execution pass rate", f"{fo['execution_pass_rate']}%  (initially {io['execution_pass_rate']}%)"],
    ["Existing Chromium tests executed in baseline", f"{M['test_counts']['existing_tests_in_baseline']}  {M['test_counts']['baseline']}"],
    ["New tests added", f"{M['test_counts']['new_tests']}  {M['test_counts']['new_tests_status']}"],
    ["Note", "Scenario metrics use unique scenarios as the denominator; test-level totals (one scenario may have many tests) are in 'Runs'."],
], first=True)
cat_rows = []
for cat, name in CATEGORIES.items():
    for phase in ("initial", "final"):
        m = M["categories"][cat][phase]
        cat_rows.append([name, phase, m["required"], m["implemented"], m["partial"], m["missing"], m["executed"], m["passed"],
                         m["failed"], m["skipped"], m["blocked"], m["not_executed"], f"{m['implementation_coverage']}%",
                         f"{m['execution_coverage']}%", f"{m['passing_coverage']}%", f"{m['execution_pass_rate']}%"])
sheet(wb, "Category Summary", ["Category", "Phase", "Required", "Implemented", "Partial", "Missing", "Executed", "Passed",
                               "Failed", "Skipped", "Blocked", "Not Executed", "Impl. Coverage", "Exec. Coverage",
                               "Passing Coverage", "Exec. Pass Rate"], cat_rows, [30, 9] + [11] * 14)
sheet(wb, "Runs", ["Run", "Role", "Run date (UTC)", "Projects", "Tests", "Passed", "Failed", "Flaky", "Skipped", "Pass rate",
                   "Archive folder (HTML report, traces, dashboard)"],
      [[r["label"], r["role"], r["date"], r["projects"], r["total"], r["passed"], r["failed"], r["flaky"], r["skipped"],
        f"{r['pass_rate']}%", "reports-archive/" + r["folder"]] for r in M["runs"]], [34, 11, 24, 30, 8, 8, 8, 8, 8, 10, 60])
try:
    history = json.loads((ROOT / "dashboard-report" / "history.json").read_text(encoding="utf-8"))
except Exception:
    history = []
sheet(wb, "Historical Trend", ["Run date (UTC)", "Tests", "Passed", "Failed", "Flaky", "Skipped", "Pass rate", "Known bugs open"],
      [[h["date"], h["total"], h["passed"], h["failed"], h.get("flaky", 0), h["skipped"], f"{round(100 * h['passRate'], 1)}%",
        h.get("bugsOpen", "")] for h in history], [26, 8, 8, 8, 8, 8, 10, 14])
sheet(wb, "Test Status Changes", ["Test (file :: title)", "16 Nov 2026 (previous)", "Baseline (this cycle)", "Final (this cycle)"],
      [list(c) for c in changes], [90, 20, 20, 20])
failing = []
for k, (run, t) in sorted(FINAL.items()):
    if t["status"] != "failed":
        continue
    v = verdict_for(t)
    failing.append([k, t["project"], run["label"], v["class"], v["bug"], v["note"], first_line(t.get("error")),
                    t["evidence"].get("trace", ""), t["evidence"].get("screenshot", ""), t["evidence"]["report"]])
sheet(wb, "Failed Tests & Traces", ["Test", "Project", "Run", "Classification", "Bug ID", "Investigation note", "Error",
                                    "Trace", "Screenshot", "Individual report"], failing,
      [60, 14, 18, 20, 9, 46, 60, 50, 50, 50])
wb.save(OUT / "QA_Execution_Summary.xlsx")
M["failed_tests"] = Counter(r[3] for r in failing)

# --------------------------------------------------------------------------- 4. bug report
evidence_by_bug = defaultdict(list)
for k, (run, t) in FINAL.items():
    if t["status"] == "failed" and verdict_for(t)["bug"]:
        evidence_by_bug[verdict_for(t)["bug"]].append(t)
for p, d in XB.items():
    for k, (run, t) in d.items():
        if t["status"] == "failed" and verdict_for(t)["bug"]:
            evidence_by_bug[verdict_for(t)["bug"]].append(t)


def bug_status(b):
    if b.get("status"):
        return b["status"]
    if not evidence_by_bug.get(b["id"]):
        return "Resolved (retest passed)"
    return "New" if b.get("new") else "Confirmed"


bug_rows = []
for b in triage.BUGS:
    ev = evidence_by_bug.get(b["id"], [])
    bug_rows.append([b["id"], b["module"], b["category"], b["environment"], b["description"], b["steps"], b["expected"],
                     b["actual"], b["severity"], b["priority"], bug_status(b),
                     "\n".join(t["evidence"].get("screenshot", "") for t in ev[:2]) or b.get("screenshot", ""),
                     "\n".join(t["evidence"].get("trace", "") for t in ev[:2]) or b.get("trace", ""),
                     b.get("remarks", ""), b.get("found", "")])
wb = Workbook()
sheet(wb, "Bugs", ["Bug ID", "Module", "Testing Category", "Environment", "Issue Description", "Steps to Reproduce",
                   "Expected Result", "Actual Result", "Severity", "Priority", "QA Status", "Screenshot Reference",
                   "Trace Report Reference", "Developer Remarks", "Found"],
      bug_rows, [9, 12, 18, 26, 40, 46, 34, 40, 10, 9, 14, 40, 40, 36, 18], first=True)
sev = Counter((r[8], r[10]) for r in bug_rows)
sheet(wb, "Summary", ["Severity", "Status", "Count"], [[s, st, n] for (s, st), n in sorted(sev.items())]
      + [[], [f"Generated {M['generated']} · latest test run {M['latest_run']}"]], [14, 30, 8])
wb.save(OUT / "QA_Bug_Report.xlsx")
M["bugs"] = {"total": len(bug_rows), "by_status": dict(Counter(r[10] for r in bug_rows)),
             "by_severity": dict(Counter(r[8] for r in bug_rows)), "new_this_cycle": [b["id"] for b in triage.BUGS if b.get("new")]}

(OUT / "metrics.json").write_text(json.dumps(M, indent=2, default=str), encoding="utf-8")

# --------------------------------------------------------------------------- 5. QA_Summary.md


def fmt_date(iso):
    return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).strftime("%d %b %Y %H:%M UTC") if "T" in str(iso) else str(iso)


def md_table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return chr(10).join(out)


fo, io_ = M["overall"]["final"], M["overall"]["initial"]
cat_rows = []
for cat, name in CATEGORIES.items():
    i, f = M["categories"][cat]["initial"], M["categories"][cat]["final"]
    cat_rows.append([name, f["required"], f"{i['implemented']} → {f['implemented']}", f["partial"], f["missing"], f["passed"], f["failed"],
                     f["skipped"], f["blocked"], f["not_executed"], f"{i['implementation_coverage']}% → **{f['implementation_coverage']}%**",
                     f"{f['execution_coverage']}%", f"{f['passing_coverage']}%", f"{f['execution_pass_rate']}%"])
cat_rows.append(["**Total**", f"**{fo['required']}**", f"**{io_['implemented']} → {fo['implemented']}**", fo["partial"], fo["missing"],
                 f"**{fo['passed']}**", f"**{fo['failed']}**", fo["skipped"], fo["blocked"], fo["not_executed"],
                 f"**{io_['implementation_coverage']}% → {fo['implementation_coverage']}%**", f"**{fo['execution_coverage']}%**",
                 f"**{fo['passing_coverage']}%**", f"**{fo['execution_pass_rate']}%**"])
bug_rows = [[r[0], r[8], r[10], r[1], r[4][:140]] for r in sorted(bug_rows, key=lambda r: (["Critical", "Major", "Moderate", "Minor"].index(r[8]) if r[8] in ("Critical", "Major", "Moderate", "Minor") else 9, r[0]))]
run_rows = [[r["label"], fmt_date(r["date"]), r["projects"], r["total"], r["passed"], r["failed"], r["skipped"], f"`reports-archive/{r['folder']}`"] for r in M["runs"]]
tc = M["test_counts"]["final"]
values = {
    "GENERATED": fmt_date(M["generated"]),
    "LATEST_RUN": fmt_date(M["latest_run"]),
    "REQUIRED": fo["required"], "IMPLEMENTED": fo["implemented"], "INITIAL_IMPLEMENTED": io_["implemented"], "PARTIAL": fo["partial"],
    "MISSING": fo["missing"], "MANUAL": fo["manual_only"], "BLOCKED_DEP": fo["blocked_dependency"], "EXECUTED": fo["executed"],
    "PASSED": fo["passed"], "FAILED": fo["failed"], "SKIPPED": fo["skipped"], "BLOCKED": fo["blocked"], "NOT_EXECUTED": fo["not_executed"],
    "TESTS_TOTAL": sum(tc.values()), "TESTS_PASSED": tc.get("passed", 0) + tc.get("flaky", 0), "TESTS_FAILED": tc.get("failed", 0),
    "TESTS_SKIPPED": tc.get("skipped", 0),
    "FAILURE_CAUSES": ", ".join(f"{n} {k.lower()}" for k, n in sorted(M["failed_tests"].items())) or "none",
    "BUGS_TOTAL": M["bugs"]["total"], "BUGS_BY_STATUS": ", ".join(f"{n} {k}" for k, n in M["bugs"]["by_status"].items()),
    "BUGS_BY_SEVERITY": ", ".join(f"{n} {k}" for k, n in M["bugs"]["by_severity"].items()),
    "IMPL_PCT": fo["implementation_coverage"], "EXEC_PCT": fo["execution_coverage"], "PASS_PCT": fo["passing_coverage"], "RATE_PCT": fo["execution_pass_rate"],
    "CATEGORY_TABLE": md_table(["Category", "Required", "Implemented (before → now)", "Partial", "Missing", "Passed", "Failed", "Skipped",
                                "Blocked", "Not run", "Implementation", "Execution", "Passing", "Pass rate"], cat_rows),
    "BUG_TABLE": md_table(["Bug", "Severity", "QA status", "Module", "Summary"], bug_rows),
    "RUN_TABLE": md_table(["Run", "Date", "Projects", "Tests", "Passed", "Failed", "Skipped", "Evidence"], run_rows),
}
summary = (OUT / "summary_template.md").read_text(encoding="utf-8")
for k, v in values.items():
    summary = summary.replace("{{" + k + "}}", str(v))
(OUT / "QA_Summary.md").write_text(summary, encoding="utf-8")

line = (f"QA reports updated {values['GENERATED']} (latest run {values['LATEST_RUN']}): {fo['required']} scenarios · "
        f"implementation {fo['implementation_coverage']}% · execution {fo['execution_coverage']}% · passing {fo['passing_coverage']}% · "
        f"pass rate {fo['execution_pass_rate']}% · {M['bugs']['total']} bugs → qa-reports/")
if QUIET:
    print(line)
else:
    print(json.dumps({"overall": M["overall"], "tests": M["test_counts"], "gaps": M["gaps"], "bugs": M["bugs"],
                      "failed_tests": M["failed_tests"]}, indent=1, default=str))
    print(line)
