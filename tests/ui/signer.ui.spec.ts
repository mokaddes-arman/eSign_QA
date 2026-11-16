import { test, expect } from '../../src/fixtures/test';
import { expectStandardUi, trackPageErrors } from '../../src/helpers/ui';

/** Signer preview UI for the newest draft (preview mode saves nothing). */
test.describe('UI · Signer preview', () => {
  test.beforeEach(async ({ preparePage, page }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    const href = await preparePage.previewLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await preparePage.settle();
  });

  test('signer preview meets the UI baseline', async ({ page, signerPreviewPage }, testInfo) => {
    const errors = trackPageErrors(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(signerPreviewPage.heading).toBeVisible();
    await expectStandardUi(page, testInfo, errors);
  });

  test('preview-only notice is announced as a status', async ({ page }) => {
    await expect(page.getByRole('status').filter({ hasText: /Preview only/ })).toBeVisible();
  });

  test('progress bar exposes numeric progress', async ({ signerPreviewPage }) => {
    await expect(signerPreviewPage.progress).toHaveAttribute('aria-valuenow', /\d+/);
  });

  test('mobile toggle narrows the document', async ({ signerPreviewPage }) => {
    const surface = signerPreviewPage.signerFields.first();
    await expect(surface).toBeVisible();
    const desktopX = (await surface.boundingBox())!.x;
    await signerPreviewPage.mobileToggle.click();
    await expect.poll(async () => (await surface.boundingBox())?.x ?? desktopX).not.toBe(desktopX);
    await signerPreviewPage.desktopToggle.click();
  });

  test('preview-as switcher shows each recipient with a field count', async ({ signerPreviewPage }) => {
    await expect(signerPreviewPage.previewAsLinks.first()).toBeVisible();
    await expect(signerPreviewPage.previewAsLinks.first()).toContainText(/\d+ fields?/);
  });
});
