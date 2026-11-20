import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../src/fixtures/test';
import { describeViolations, scanAccessibility } from '../../src/helpers/a11y';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { expectNoHorizontalOverflow } from '../../src/helpers/ui';
import { waitForHydration } from '../../src/helpers/wait';

/*
 * Automated accessibility audit with axe-core against WCAG 2.1 A/AA, plus keyboard,
 * focus and reflow checks that axe cannot do. Critical/serious axe violations fail
 * the test; moderate/minor ones are attached and annotated. Automated tools find
 * roughly a third of WCAG issues — screen-reader passes stay manual (QA_Summary.md).
 * Case ids A11Y-001…A11Y-008 (docs/TEST_CASES.md §17).
 */
const GUEST_PAGES = ['/', '/login', '/register', '/login/forgot', '/pricing'];
const APP_PAGES = ['/overview', '/documents', '/documents/prepare', '/contacts', '/reports', '/support', '/account/profile', '/account/billing'];

test.describe('Accessibility · axe WCAG 2.1 AA @a11y', () => {
  test.describe('guest pages', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const path of GUEST_PAGES) {
      test(`A11Y-001 ${path} has no critical or serious WCAG violations`, async ({ page }, testInfo) => {
        await page.goto(path);
        await waitForHydration(page);
        const summary = await scanAccessibility(page, testInfo);
        expect(summary.blocking, describeViolations(summary)).toBe(0);
      });
    }
  });

  for (const path of APP_PAGES) {
    test(`A11Y-002 ${path} has no critical or serious WCAG violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await waitForHydration(page);
      expect(page.url(), 'still signed in').not.toMatch(/\/login/);
      const summary = await scanAccessibility(page, testInfo);
      expect(summary.blocking, describeViolations(summary)).toBe(0);
    });
  }
});

test.describe('Accessibility · known defects @a11y', () => {
  test('BUG-19 shell controls include their visible text in the accessible name (WCAG 2.5.3)', knownBug(KNOWN_BUGS.BUG19), async ({ page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await page.goto('/overview');
    await waitForHydration(page);
    const result = await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze();
    const nodes = result.violations.flatMap((v) => v.nodes.map((n) => n.html.slice(0, 120)));
    expect(nodes, `controls whose accessible name omits their visible text:\n${nodes.join('\n')}`).toEqual([]);
  });
});

test.describe('Accessibility · keyboard & focus @a11y', () => {
  test.describe('guest', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('A11Y-003 sign-in form is operable in a logical Tab order', async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.emailInput.focus();
      const order: string[] = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return `${el?.tagName}:${el?.getAttribute('type') ?? el?.getAttribute('role') ?? ''}:${(el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 30)}`;
        }));
      }
      const passwordAt = order.findIndex((s) => /INPUT:password/.test(s));
      const continueAt = order.findIndex((s) => /Continue/.test(s));
      expect(passwordAt, `Tab order: ${order.join(' → ')}`).toBeGreaterThanOrEqual(0);
      expect(continueAt, `Continue reachable by Tab: ${order.join(' → ')}`).toBeGreaterThan(passwordAt);
    });

    test('A11Y-004 keyboard focus is visible on form fields and buttons', async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.emailInput.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const visible = async () => page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      });
      expect(await visible(), 'focus indicator on the e-mail field').toBe(true);
      await loginPage.signInButton.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      expect(await visible(), 'focus indicator on Continue').toBe(true);
    });

    test('A11Y-005 page language and input purposes are declared (WCAG 3.1.1, 1.3.5)', async ({ page, loginPage, registerPage }) => {
      await loginPage.goto();
      expect(await page.locator('html').getAttribute('lang')).toMatch(/^en/);
      await expect(page.locator('input[type="email"], input[name*="email" i]').first()).toHaveAttribute('autocomplete', /email|username/);

      await registerPage.goto();
      await expect(registerPage.fullNameInput).toHaveAttribute('autocomplete', /name/);
      await expect(registerPage.emailInput).toHaveAttribute('autocomplete', /email|username/);
      await expect(registerPage.companyInput).toHaveAttribute('autocomplete', /organization/);
    });

    test('A11Y-006 BUG-20 sign-in reflows at 320 CSS px without horizontal scroll (WCAG 1.4.10)', knownBug(KNOWN_BUGS.BUG20), async ({ page, loginPage }) => {
      test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
      await page.setViewportSize({ width: 320, height: 640 });
      await loginPage.goto();
      await expectNoHorizontalOverflow(page, 2);
      await expect(loginPage.signInButton).toBeInViewport({ ratio: 0.5 });
    });
  });

  test('A11Y-007 modal dialog keeps focus inside while open', async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.openNewContact();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const inside = await contactsPage.dialog.evaluate((d) => d.contains(document.activeElement));
      expect(inside, `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(contactsPage.dialog).toBeHidden();
    /* Focus returns to the control that opened the dialog. */
    await expect(contactsPage.newContactButton).toBeFocused();
  });

  test('A11Y-008 BUG-20 app shell reflows at 320 CSS px (WCAG 1.4.10)', knownBug(KNOWN_BUGS.BUG20), async ({ page, overviewPage }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await page.setViewportSize({ width: 320, height: 640 });
    await overviewPage.goto();
    await expectNoHorizontalOverflow(page, 4);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('Accessibility · text resize @a11y', () => {
  for (const path of ['/overview', '/documents', '/contacts', '/reports', '/account/billing']) {
    test(`A11Y-011 ${path} keeps content at 200 % text size (WCAG 1.4.4)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      await page.addStyleTag({ content: 'html { font-size: 200% !important }' });
      await expectNoHorizontalOverflow(page, 2);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeInViewport();
      const box = (await h1.boundingBox())!;
      expect(box.x + box.width, 'page heading is clipped on the right').toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  }
});
