/**
 * Automatic QA reporting after every run.
 *
 *   reporter: [..., ['./reporters/qa-reports-reporter.ts']]
 *
 * In onExit() — which Playwright calls after EVERY reporter has finished onEnd(), so the
 * HTML report, JUnit file and dashboard already exist — it:
 *   1. archives the run:   reports-archive/<run date>_auto/  (npm run report:archive -- auto)
 *   2. regenerates:        qa-reports/QA_*.xlsx and qa-reports/QA_Summary.md (dated)
 *
 * It never fails or slows a test run's result: problems are printed as warnings.
 * Disable with QA_REPORTS=off. Skipped on CI (artifacts are uploaded there instead) and
 * for runs that executed no tests (e.g. --list).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

const ROOT = path.resolve(__dirname, '..');

export default class QaReportsReporter implements Reporter {
  private tests = 0;
  /* Counted in onTestEnd, so --list (which never runs a test) does nothing. */
  private finished = 0;
  private status: FullResult['status'] = 'passed';

  onBegin(_config: FullConfig, suite: Suite): void {
    this.tests = suite.allTests().length;
  }

  onTestEnd(_test: TestCase, _result: TestResult): void {
    this.finished++;
  }

  onEnd(result: FullResult): void {
    this.status = result.status;
  }

  async onExit(): Promise<void> {
    if (process.env.QA_REPORTS === 'off' || process.env.CI || this.tests === 0 || this.finished === 0 || this.status === 'interrupted') return;

    const archive = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'archive-reports.mjs'), 'auto'], { cwd: ROOT, encoding: 'utf8' });
    if (archive.status !== 0) {
      console.warn(`[qa-reports] archiving failed: ${(archive.stderr || archive.stdout).trim()}`);
      return;
    }
    console.log(`[qa-reports] ${archive.stdout.trim()}`);

    const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const gen = spawnSync(python, [path.join(ROOT, 'qa-reports', 'generate_reports.py'), '--quiet'], { cwd: ROOT, encoding: 'utf8' });
    if (gen.error || gen.status !== 0) {
      console.warn(
        `[qa-reports] report generation skipped: ${gen.error?.message ?? (gen.stderr || gen.stdout).trim().split('\n').pop()}` +
          ' (needs Python 3 with openpyxl: python -m pip install openpyxl)',
      );
      return;
    }
    console.log(`[qa-reports] ${gen.stdout.trim().split('\n').pop()}`);
  }

  printsToStdio(): boolean {
    return false;
  }
}
