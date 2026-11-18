import type { Locator, Page, TestInfo } from '@playwright/test';

/**
 * Self-healing locators.
 *
 * `heal(page, name, primary, ...fallbacks)` returns one locator that matches the
 * primary strategy or, if the app's markup drifted, the first fallback that still
 * finds the element (role → visible text → title/aria-label …). Tests therefore fail
 * only when an *expectation* is not met, not because one selector changed.
 *
 * Healing is never silent: after every test `reportHealing()` records which
 * locators were found only through a fallback, so the primary can be updated.
 */
interface HealEntry {
  name: string;
  primary: Locator;
  fallbacks: Locator[];
}

const registry = new WeakMap<Page, HealEntry[]>();

export function heal(page: Page, name: string, primary: Locator, ...fallbacks: Locator[]): Locator {
  const entries = registry.get(page) ?? [];
  entries.push({ name, primary, fallbacks });
  registry.set(page, entries);
  /* `.or()` keeps Playwright's auto-waiting; `.first()` because two strategies can
     match the same control through different nodes. */
  return fallbacks.reduce<Locator>((combined, next) => combined.or(next), primary).first();
}

/** Annotates every healed locator on this page (primary found nothing, a fallback did). */
export async function reportHealing(page: Page, testInfo: TestInfo): Promise<string[]> {
  const healed: string[] = [];
  if (page.isClosed()) return healed;
  for (const entry of registry.get(page) ?? []) {
    try {
      if ((await entry.primary.count()) > 0) continue;
      for (let i = 0; i < entry.fallbacks.length; i++) {
        if ((await entry.fallbacks[i].count()) > 0) {
          const note = `${entry.name}: primary locator found nothing on ${page.url()}; healed by fallback #${i + 1}. Update the page object.`;
          healed.push(note);
          testInfo.annotations.push({ type: 'self-healed', description: note });
          break;
        }
      }
    } catch {
      /* page navigated away / closed — nothing to report */
    }
  }
  return healed;
}

const PLAIN = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();

/**
 * Turns a raw Playwright error into one plain sentence that says what went wrong,
 * and — for a missing element — what similar elements the page did contain.
 */
export async function explainFailure(page: Page | undefined, rawMessage: string): Promise<string> {
  const message = PLAIN(rawMessage);
  const locator = /Locator: (\S.*?)(?: Expected| Received| Timeout| Error| Call log|$)/.exec(message)?.[1]?.trim();
  const custom = /^Error: (?!expect\()([^\n]+?)(?:\s+expect\(|\s+Expected|$)/.exec(message)?.[1]?.trim();

  if (/Precondition failed/.test(message)) {
    return `Test-data precondition not met — ${/Precondition failed[^:]*: (.*)/.exec(message)?.[1] ?? message}. Not a product defect.`;
  }
  if (/reason=superseded|signed in elsewhere/.test(message)) {
    return 'Environment: the saved session was signed out by another sign-in (single active session). Run npm run auth:refresh.';
  }
  if (/Page crashed|Target crashed/.test(message)) {
    return 'Environment: the browser tab crashed during the test (seen only with Playwright\'s Firefox build on /documents <select> controls; not reproducible in a standalone session). Not a product defect.';
  }
  if (/net::ERR_|ERR_CONNECTION|page\.goto: Timeout|reach the eSignPro API/.test(message)) {
    return `Environment: the live site did not respond in time (${/net::ERR_\w+|page\.goto: Timeout \d+ms/.exec(message)?.[0] ?? 'timeout'}).`;
  }
  if (/element\(s\) not found|waiting for (getBy|locator)/.test(message) && locator) {
    const where = page && !page.isClosed() ? page.url() : 'the page';
    const hints = page && !page.isClosed() ? await similarElements(page, locator) : [];
    return (
      `${custom ? custom + ' — ' : ''}UI element not found: ${locator} on ${where}.` +
      (hints.length ? ` Closest elements on the page: ${hints.join(' | ')}.` : ' No similar element exists — the feature may be missing or not yet rendered.')
    );
  }
  const expected = /Expected(?: pattern| string| value)?: (.*?)(?: Received| Timeout|$)/.exec(message)?.[1];
  const received = /Received(?: string| value)?: (.*?)(?: Timeout| Call log|$)/.exec(message)?.[1];
  if (expected || received) {
    return `${custom ? custom + ' — ' : ''}Expectation not met: expected ${expected?.trim() ?? '?'}, got ${received?.trim() ?? '?'}${locator ? ` (${locator})` : ''}.`;
  }
  return custom ?? message.slice(0, 300);
}

/** Visible elements whose accessible name shares a word with the missing locator's name. */
async function similarElements(page: Page, locatorText: string): Promise<string[]> {
  const name = /name: ['"/]?([^'"/,}]+)/.exec(locatorText)?.[1] ?? /getByText\(['"/]?([^'"/)]+)/.exec(locatorText)?.[1] ?? '';
  const words = name.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  return page
    .evaluate((ws) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [role], h1, h2, h3, label')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const label = (el.getAttribute('aria-label') || el.innerText || (el as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ');
        if (label && ws.some((w) => label.toLowerCase().includes(w))) {
          out.push(`${el.getAttribute('role') || el.tagName.toLowerCase()} "${label.slice(0, 40)}"`);
        }
        if (out.length >= 5) break;
      }
      return out;
    }, words)
    .catch(() => []);
}
