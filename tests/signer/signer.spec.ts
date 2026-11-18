import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible } from '../../src/helpers/wait';

/**
 * Signer preview of the newest draft. Preview mode saves nothing and notifies
 * no one, so these checks are read-only.
 */
test.describe('Signer experience preview', () => {
  test.beforeEach(async ({ preparePage, page }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    const id = preparePage.documentIdFromUrl();
    await page.goto(`/documents/${id}/signer-view`, { waitUntil: 'domcontentloaded' });
    await preparePage.settle();
  });

  test('shows signing controls in preview-only mode @smoke', async ({ signerPreviewPage }) => {
    await expect(signerPreviewPage.heading).toBeVisible();
    await expect(signerPreviewPage.previewNotice).toBeVisible();
    for (const control of [
      signerPreviewPage.startSigningButton,
      signerPreviewPage.finishButton,
      signerPreviewPage.downloadUnsignedButton,
    ]) {
      await expect(control).toBeVisible();
    }
    /* Below ~1440 px Disclosure / Decline / Reassign move into the "More actions" menu (responsive layout). */
    const page = signerPreviewPage.page;
    if (await signerPreviewPage.disclosureButton.isVisible().catch(() => false)) {
      for (const control of [signerPreviewPage.disclosureButton, signerPreviewPage.declineButton, signerPreviewPage.reassignButton]) {
        await expect(control).toBeVisible();
      }
    } else {
      const menu = page.getByRole('menu');
      await clickUntilVisible(page.getByRole('button', { name: 'More actions' }), menu);
      for (const name of ['Disclosure', 'Decline', 'Reassign']) {
        await expect(menu.getByRole('menuitem', { name })).toBeVisible();
      }
      await page.keyboard.press('Escape');
    }
    await expect(
      signerPreviewPage.page.getByRole('progressbar', { name: 'Required fields completed' }),
    ).toBeVisible();
  });

  test('toggles desktop and mobile viewports', async ({ signerPreviewPage }) => {
    await expect(signerPreviewPage.desktopToggle).toHaveAttribute('aria-pressed', 'true');
    await signerPreviewPage.mobileToggle.click();
    await expect(signerPreviewPage.mobileToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(signerPreviewPage.desktopToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('returns to the builder', async ({ signerPreviewPage }) => {
    await signerPreviewPage.page.getByRole('link', { name: 'Back to editing' }).click();
    await expect(signerPreviewPage.page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/);
  });
});
