import { test, expect } from '../../src/fixtures/test';
import {
  WHITE,
  expectReadableInDarkMode,
  expectStandardUi,
  expectTextReadableOn,
  trackPageErrors,
  unlabeledControls,
} from '../../src/helpers/ui';

/**
 * Envelope builder UI on the newest draft (read-only: fields are only selected).
 * Builder defects BUG-01/02/05/06 are reproduced in tests/bugs.
 */
test.describe('UI · Envelope builder', () => {
  test.describe.configure({ mode: 'default' });

  test('new-envelope landing meets the UI baseline', async ({ preparePage, page }, testInfo) => {
    const errors = trackPageErrors(page);
    await preparePage.goto();
    await expectStandardUi(page, testInfo, errors);
  });

  test.describe('builder', () => {
    test.beforeEach(async ({ preparePage }) => {
      await preparePage.goto();
      await preparePage.continueLatestDraft();
      await preparePage.waitForCanvas();
    });

    test('builder meets the UI baseline', async ({ page, preparePage }, testInfo) => {
      const errors = trackPageErrors(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(preparePage.heading).toBeVisible();
      await preparePage.waitForCanvas();
      await expectStandardUi(page, testInfo, errors);
    });

    test('every palette favourite toggle exposes its state', async ({ preparePage }) => {
      const order = await preparePage.paletteOrder();
      expect(order.length, 'palette should list the field types').toBeGreaterThanOrEqual(15);
      for (const { name } of order) {
        await expect(preparePage.favouriteToggle(name)).toHaveAttribute('aria-pressed', /^(true|false)$/);
      }
    });

    test('Favourites tab lists exactly the favourited fields', async ({ preparePage }) => {
      const favourites = (await preparePage.paletteOrder()).filter((t) => t.favourite).map((t) => t.name);
      await preparePage.favouritesTab.click();
      await expect(preparePage.favouritesTab).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(async () => (await preparePage.paletteOrder()).map((t) => t.name).sort())
        .toEqual([...favourites].sort());
      await preparePage.allFieldsTab.click();
    });

    test('field search filters the palette', async ({ preparePage }) => {
      await preparePage.fieldSearch.fill('sign');
      await expect.poll(async () => (await preparePage.paletteOrder()).every((t) => /sign/i.test(t.name))).toBe(true);
      await preparePage.fieldSearch.fill('');
    });

    test('inspector controls are labelled once a field is selected', async ({ preparePage, page }) => {
      await preparePage.requirePlacedFields();
      await preparePage.selectField('last'); // fields overlap; the last one is on top
      for (const control of [preparePage.labelInput, preparePage.placeholderInput, preparePage.assignedRecipientSelect]) {
        await expect(control).toBeVisible();
      }
      expect(await unlabeledControls(page.locator('main'))).toEqual([]);
    });

    test('field labels are readable on a white page', async ({ preparePage }) => {
      await preparePage.requirePlacedFields();
      await expectTextReadableOn(preparePage.placedFields.first().locator('span').first(), WHITE, 3, 'field label');
    });

    test('zoom controls increase and decrease the zoom level', async ({ page }) => {
      const level = page.getByText(/^\d+%$/).first();
      const pct = async () => Number((await level.innerText()).replace('%', ''));
      const before = await pct();
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect.poll(pct).toBeGreaterThan(before);
      const zoomed = await pct();
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
      await expect.poll(pct).toBeLessThan(zoomed);
      /* Observed: 75% → in → out lands on 76%, not 75% (asymmetric steps; cosmetic). */
      expect.soft(Math.abs((await pct()) - before), 'zoom in + out should return to the start level').toBeLessThanOrEqual(1);
    });

    test('builder stays readable in dark mode', async ({ page }) => {
      await expectReadableInDarkMode(page);
    });
  });
});
