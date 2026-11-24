import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * eSignPro test-health dashboard.
 *
 * Writes one self-contained HTML file (no network, no dependencies) next to the
 * built-in Playwright HTML report and opens it in a new browser tab when the run
 * finishes locally. Besides pass/fail totals it tracks:
 *   - Known bugs  — tests annotated with `bug` (see src/helpers/bugs.ts); a failing
 *                   bug test means the defect still reproduces.
 *   - Modules     — results grouped by product module and test layer
 *                   (functional / ui / flow / bug).
 *
 * Usage in playwright.config.ts:
 *   ['./reporters/dashboard-reporter.ts', { outputFile: 'dashboard-report/index.html', open: 'auto' }]
 *
 * `open`: 'auto' (default — open locally, never on CI), 'always', 'never'.
 * DASHBOARD_OPEN=never|always overrides it from the command line.
 */

type Status = 'passed' | 'failed' | 'flaky' | 'skipped';
type OpenMode = 'auto' | 'always' | 'never';

interface Options {
  outputFile?: string;
  open?: OpenMode;
  projectName?: string;
}

interface Attempt {
  status: Status;
  duration: number;
  error: { message: string; stack: string } | null;
  result: TestResult;
}

interface Entry {
  id: string;
  title: string;
  file: string;
  line: number;
  project: string;
  tags: string[];
  annotations: { type: string; description?: string }[];
  expectedStatus: string;
  attempts: Attempt[];
  duration?: number;
  startTime?: Date;
  workerIndex?: number;
}

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const CSS_PATH = path.join(__dirname, 'assets', 'dashboard.css');
const JS_PATH = path.join(__dirname, 'assets', 'dashboard.js');

const normalizeStatus = (s: string): Status =>
  s === 'timedOut' || s === 'interrupted' ? 'failed' : (s as Status);

/* Playwright hands colourised error strings straight to reporters. */
const stripAnsi = (s: unknown) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

/* Drop trailing " @tag" tokens so titles read cleanly. */
const stripTags = (title: string) => String(title || '').replace(/(\s+@[\w-]+)+\s*$/, '').trim();

/* Redact anything that looks like a secret before it is written into the HTML. */
const redact = (s: string) =>
  s
    .replace(/(password|secret|token|api[_-]?key|authorization|cookie)(["'\s:=]+)[^\s"',;]+/gi, '$1$2[redacted]')
    .replace(/\bsk_(live|test)_[0-9a-zA-Z]+/g, 'sk_$1_[redacted]');

function playwrightVersion(): string {
  for (const pkg of ['playwright-core', '@playwright/test']) {
    try {
      const json = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'node_modules', pkg, 'package.json'), 'utf8'),
      );
      return json.version;
    } catch {
      /* try the next one */
    }
  }
  return '';
}

function flattenSteps(steps: TestStep[] | undefined, out: string[] = []): string[] {
  for (const step of steps || []) {
    if (step.title && step.category !== 'pw:api') out.push(step.title);
    if (step.steps?.length) flattenSteps(step.steps, out);
  }
  return out;
}

/* Cluster key: first line of the error, numbers masked, whitespace collapsed. */
function clusterKey(message?: string): string {
  const first = String(message || 'unknown error').split('\n')[0];
  return first.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * tests/<module>/<file>.spec.ts            → functional
 * tests/ui/<module>.ui.spec.ts             → ui
 * tests/flows/<module>.flow.spec.ts        → flow
 * tests/bugs/<file>.spec.ts                → bug
 */
function classify(file: string): { module: string; layer: string } {
  const parts = file.replace(/^tests\//, '').split('/');
  const base = (parts[parts.length - 1] || '').replace(/\.(ui|flow)?\.?spec\.ts$/, '').replace(/\.spec\.ts$/, '');
  if (parts[0] === 'ui') return { module: base, layer: 'ui' };
  if (parts[0] === 'flows') return { module: base, layer: 'flow' };
  if (parts[0] === 'bugs') return { module: base, layer: 'bug' };
  return { module: parts.length > 1 ? parts[0] : base, layer: 'functional' };
}

function openInBrowser(target: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  try {
    const child = spawn(cmd, [target], { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    /* opening is a convenience; never fail the run because of it */
  }
}

export default class DashboardReporter implements Reporter {
  private readonly outputFile: string;
  private readonly openMode: OpenMode;
  private readonly projectName: string;
  private readonly byId = new Map<string, Entry>();
  private readonly workerIndexes = new Set<number>();
  private runStart = new Date();
  private rootDir = process.cwd();
  private configDir = process.cwd();
  private config?: FullConfig;

  constructor(options: Options = {}) {
    this.outputFile = path.resolve(options.outputFile || 'dashboard-report/index.html');
    const envOpen = process.env.DASHBOARD_OPEN as OpenMode | undefined;
    this.openMode = envOpen || options.open || 'auto';
    this.projectName = options.projectName || 'eSignPro QA';
  }

  onBegin(config: FullConfig): void {
    this.config = config;
    this.rootDir = config.rootDir || process.cwd();
    this.configDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.runStart = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    let entry = this.byId.get(test.id);
    if (!entry) {
      const location = test.location;
      /* Tests generated by a helper (e.g. uiBaseline) report the helper as their
         location; group them under the spec file that registered them instead. */
      let suite: TestCase['parent'] | undefined = test.parent;
      while (suite && suite.type !== 'file') suite = suite.parent;
      const specFile = suite?.location?.file || location?.file;
      const file = specFile ? path.relative(this.configDir, specFile).split(path.sep).join('/') : 'unknown';
      entry = {
        id: test.id,
        title: stripTags(test.title),
        file,
        line: location?.line || 0,
        project: test.parent?.project()?.name || 'default',
        tags: (test.tags || []).map((t) => String(t).replace(/^@/, '')),
        annotations: test.annotations || [],
        expectedStatus: test.expectedStatus,
        attempts: [],
      };
      this.byId.set(test.id, entry);
    }
    /* Annotations added at runtime (test.info().annotations) only exist on the result. */
    entry.annotations = [...(result.annotations ?? test.annotations ?? [])];
    entry.expectedStatus = test.expectedStatus;

    const error = result.error
      ? {
          message: redact(stripAnsi(result.error.message).split('\n')[0].trim().slice(0, 240)),
          stack: redact(stripAnsi(result.error.stack || result.error.message)),
        }
      : null;

    entry.attempts.push({ status: normalizeStatus(result.status), duration: result.duration, error, result });
    entry.duration = result.duration;
    entry.startTime = result.startTime;
    entry.workerIndex = result.workerIndex;
    if (result.workerIndex != null) this.workerIndexes.add(result.workerIndex);
  }

  onEnd(_result: FullResult): void {
    const runEnd = new Date();
    const tests = [...this.byId.values()].map((e) => this.finalize(e));
    if (!tests.length) return; // e.g. `--list`: keep the previous dashboard

    /* `passed` counts every test that met its expectation, including open known-bug checks that
       failed under KNOWN_BUGS=expect-fail; `expectedFailures` is that subset. Displays show
       "Passed = passed − expectedFailures" next to the expected failures. */
    const totals: Record<Status | 'total' | 'expectedFailures', number> = { total: tests.length, passed: 0, failed: 0, flaky: 0, skipped: 0, expectedFailures: 0 };
    for (const t of tests) {
      totals[t.status as Status]++;
      if (t.expectedFailure) totals.expectedFailures++;
    }
    const denom = totals.passed + totals.failed + totals.flaky;
    const passRate = denom ? (totals.passed + totals.flaky) / denom : 0;

    const dashboardDir = path.dirname(this.outputFile);
    fs.mkdirSync(dashboardDir, { recursive: true });
    const reportUrl = path
      .relative(dashboardDir, path.join(this.configDir, 'playwright-report', 'index.html'))
      .split(path.sep)
      .join('/');

    fs.rmSync(path.join(dashboardDir, 'assets'), { recursive: true, force: true });
    this.copyAttachments(tests, dashboardDir);
    for (const t of tests) t.reportUrl = `${reportUrl}#?testId=${encodeURIComponent(t.id)}`;

    const historyPath = path.join(dashboardDir, 'history.json');
    const history = this.readHistory(historyPath);
    const previous = history.length ? history[history.length - 1] : null;

    const bugs = tests.filter((t) => t.bug);
    const bugsOpen = bugs.filter((t) => t.bug.state === 'open').length;

    const summary = {
      date: runEnd.toISOString(),
      total: totals.total,
      passed: totals.passed,
      failed: totals.failed,
      flaky: totals.flaky,
      skipped: totals.skipped,
      expectedFailures: totals.expectedFailures,
      passRate,
      bugsOpen,
    };
    const nextHistory = [...history, summary].slice(-20);

    const payload = {
      projectName: this.projectName,
      baseUrl: process.env.BASE_URL || 'https://esignpro.net',
      runDate: runEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      runStart: this.runStart.toISOString(),
      runEnd: runEnd.toISOString(),
      durationMs: runEnd.getTime() - this.runStart.getTime(),
      workers:
        this.workerIndexes.size || (typeof this.config?.workers === 'number' ? this.config.workers : 1),
      branch: process.env.GITHUB_REF_NAME || process.env.GIT_BRANCH || '',
      commit: (process.env.GITHUB_SHA || '').slice(0, 8),
      env: process.env.CI ? 'CI' : 'local',
      playwrightVersion: playwrightVersion(),
      suites: new Set(tests.map((t) => t.file)).size,
      projects: [...new Set(tests.map((t) => t.project))],
      totals,
      passRate,
      previousPassRate: previous?.passRate ?? null,
      history: nextHistory,
      clusters: this.clusters(tests),
      bugsOpen,
      tests,
    };

    fs.writeFileSync(this.outputFile, this.html(payload));
    fs.writeFileSync(historyPath, JSON.stringify(nextHistory, null, 2));
    fs.writeFileSync(
      path.join(dashboardDir, 'last-run.json'),
      JSON.stringify({ passRate, totals, bugsOpen, runDate: payload.runDate }, null, 2),
    );

    console.log(
      `\nDashboard: ${this.outputFile}  (${totals.passed - totals.expectedFailures} passed, ` +
        `${totals.expectedFailures} expected failures (open bugs), ${totals.failed} failed, ` +
        `${totals.flaky} flaky, ${totals.skipped} skipped, ${(passRate * 100).toFixed(1)}% pass, ` +
        `${bugsOpen}/${bugs.length} known bugs reproduced)`,
    );

    const shouldOpen =
      this.openMode === 'always' || (this.openMode === 'auto' && !process.env.CI && process.stdout.isTTY);
    if (shouldOpen) openInBrowser(this.outputFile);
  }

  printsToStdio(): boolean {
    return false;
  }

  // ---------------------------------------------------------------------------

  private finalize(entry: Entry) {
    const last = entry.attempts[entry.attempts.length - 1];
    const expectedToFail = entry.expectedStatus === 'failed';
    let status: Status = last.status;
    /* `test.fail()` inverts the outcome: a failure is the expected result. */
    if (expectedToFail && status === 'failed') status = 'passed';
    else if (expectedToFail && status === 'passed') status = 'failed';
    if (status === 'passed' && entry.attempts.slice(0, -1).some((a) => a.status === 'failed') && !expectedToFail) {
      status = 'flaky';
    }

    /* Met its expectation by failing: an open known bug under KNOWN_BUGS=expect-fail. */
    const expectedFailure = expectedToFail && last.status === 'failed';

    const ann = (type: string) => entry.annotations.find((a) => a.type === type)?.description;
    const { module, layer } = classify(entry.file);

    const bugId = ann('bug');
    const bug = bugId
      ? {
          id: bugId,
          severity: ann('severity') || '',
          summary: ann('summary') || entry.title,
          expected: ann('expected') || '',
          caseId: ann('case') || '',
          /* The raw attempt outcome decides whether the defect still reproduces. */
          state: last.status === 'skipped' ? 'not run' : last.status === 'failed' ? 'open' : 'not reproduced',
        }
      : null;

    const attachments = last.result?.attachments || [];
    const find = (name: string) => attachments.find((a) => a.name === name);

    return {
      id: entry.id,
      title: entry.title,
      file: entry.file,
      line: entry.line,
      project: entry.project,
      tags: entry.tags,
      module,
      layer,
      caseIds: entry.annotations.filter((a) => a.type === 'case').map((a) => a.description),
      status,
      expectedFailure,
      duration: last.duration,
      startTime: entry.startTime,
      workerIndex: entry.workerIndex,
      error: last.error,
      steps: [...new Set(flattenSteps(last.result?.steps))].slice(0, 60),
      attempts: entry.attempts.map((a) => ({ status: a.status, duration: a.duration })),
      retries: entry.attempts.length - 1,
      bug,
      endpoint: '',
      httpStatus: null,
      reportUrl: '',
      _attachments: { screenshot: find('screenshot'), video: find('video'), trace: find('trace') } as Record<
        string,
        { path?: string } | undefined
      >,
    } as Record<string, any>;
  }

  private copyAttachments(tests: Record<string, any>[], dashboardDir: string): void {
    tests.forEach((test, index) => {
      for (const kind of ['screenshot', 'video', 'trace']) {
        const att = test._attachments[kind];
        if (!att?.path) continue;
        const dir = path.join(dashboardDir, 'assets', String(index));
        fs.mkdirSync(dir, { recursive: true });
        const dest = path.join(dir, path.basename(att.path));
        try {
          fs.copyFileSync(att.path, dest);
          test[kind] = path.relative(dashboardDir, dest).split(path.sep).join('/');
        } catch {
          /* attachment may already be gone; skip the link */
        }
      }
      delete test._attachments;
    });
  }

  private clusters(tests: Record<string, any>[]) {
    const map = new Map<string, { message: string; count: number; tests: string[] }>();
    for (const t of tests) {
      if (t.status !== 'failed' && t.status !== 'flaky') continue;
      const key = clusterKey(t.error?.message);
      if (!map.has(key)) map.set(key, { message: key, count: 0, tests: [] });
      const c = map.get(key)!;
      c.count++;
      c.tests.push(`${t.project}: ${t.title}`);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  /* History is best-effort: a missing or corrupt file just starts a new one. */
  private readHistory(file: string): any[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.passRate === 'number') : [];
    } catch {
      return [];
    }
  }

  private html(payload: unknown): string {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    const js = fs.readFileSync(JS_PATH, 'utf8');
    const data = JSON.stringify(payload).replace(/</g, '\\u003c');
    return template
      .split('/*__DASHBOARD_CSS__*/')
      .join(css)
      .split('/*__DASHBOARD_DATA__*/')
      .join(data)
      .split('/*__DASHBOARD_JS__*/')
      .join(js);
  }
}
