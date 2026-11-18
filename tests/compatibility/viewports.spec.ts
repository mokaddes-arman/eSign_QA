import { test, expect } from '../../src/fixtures/test';
import { expectNoHorizontalOverflow } from '../../src/helpers/ui';
import { waitForHydration } from '../../src/helpers/wait';

/*
 * Screen-size compatibility. Browser engines are covered by running @smoke in the
 * firefox / webkit / mobile-chrome projects (playwright.config.ts); this spec adds
 * the viewports those projects do not: small phone, tablet portrait/landscape and
 * a large desktop. Case ids COMP-001…COMP-003 (docs/TEST_CASES.md §17).
 */
const VIEWPORTS = [
  { name: 'small phone 360×640', width: 360, height: 640 },
  { name: 'tablet portrait 768×1024', width: 768, height: 1024 },
  { name: 'tablet landscape 1024×768', width: 1024, height: 768 },
  { name: 'desktop 1920×1080', width: 1920, height: 1080 },
];

test.describe('Compatibility · viewports @compat', () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const path of ['/overview', '/documents', '/contacts', '/account/billing']) {
        test(`COMP-001 ${path} lays out without horizontal scroll`, async ({ page }) => {
          await page.goto(path);
          await waitForHydration(page);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectNoHorizontalOverflow(page, 4);
        });
      }

      test('COMP-002 navigation is reachable', async ({ page, navigation }) => {
        await page.goto('/overview');
        await waitForHydration(page);
        await navigation.open();
        await expect(navigation.sectionLink('Documents')).toBeVisible();
        await navigation.sectionLink('Documents').click();
        await expect(page).toHaveURL(/\/documents/);
      });
    });
  }

  test.describe('guest landing', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const vp of VIEWPORTS) {
      test(`COMP-003 landing and sign-in fit ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        for (const path of ['/', '/login']) {
          await page.goto(path);
          await waitForHydration(page);
          await expectNoHorizontalOverflow(page, 4);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        }
      });
    }
  });
});
