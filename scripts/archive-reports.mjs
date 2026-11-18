/**
 * Copies the current run's reports into reports-archive/<timestamp>/ so the next
 * Playwright run (which wipes test-results/ and playwright-report/) never overwrites
 * history. Run before every suite:  npm run report:archive
 *
 * Archived per run:
 *   playwright-report/   HTML report (+ embedded traces under data/ and trace/)
 *   test-results/        JUnit XML, traces, screenshots, videos, error-context.md
 *   dashboard-report/    test-health dashboard + last-run.json + history.json
 *
 * Optional label: npm run report:archive -- baseline
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const sources = ['playwright-report', 'test-results', 'dashboard-report'];
const label = (process.argv[2] || '').replace(/[^\w-]/g, '');

const lastRun = path.join(root, 'dashboard-report', 'last-run.json');
let stamp = new Date().toISOString();
try {
  /* Name the folder after the run it holds, not after "now". */
  stamp = JSON.parse(fs.readFileSync(lastRun, 'utf8')).runDate || fs.statSync(lastRun).mtime.toISOString();
} catch {
  /* No dashboard yet: fall back to the current time. */
}
const folder = stamp.replace(/[:.]/g, '-') + (label ? `_${label}` : '');
const target = path.join(root, 'reports-archive', folder);

if (fs.existsSync(target)) {
  console.log(`Already archived: ${path.relative(root, target)}`);
  process.exit(0);
}

let copied = 0;
for (const name of sources) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(target, name), { recursive: true });
  copied++;
}
console.log(copied ? `Archived ${copied} report folder(s) → ${path.relative(root, target)}` : 'Nothing to archive.');
