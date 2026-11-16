import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, bugCheckpoint } from '../../src/helpers/bugs';
import { BLACK, expectTextReadableOn } from '../../src/helpers/ui';

/**
 * UF-17 / UF-18 / UF-19 / UF-21 / UF-22 — a sender prepares an envelope end to end
 * on the newest draft: finds a field, places and configures it, checks it persisted,
 * renames the document, previews it as the recipients, and reviews the workflow
 * checklist. Everything is reverted at the end; nothing is sent.
 *
 * Checkpoints use expect.soft so the whole journey is reported even when an early
 * checkpoint fails. Checkpoints tied to a known defect name it (BUG-xx).
 */
test.describe('Flow · Prepare an envelope', () => {
  test('UF-19 sender places, configures and previews a field @flow', async ({ preparePage, signerPreviewPage, workflowPage, page }) => {
    test.setTimeout(180_000);
    const label = `QA flow ${Date.now() % 100000}`;
    const placeholder = 'Type your answer';

    /* The canvas names a field by its TYPE and position ("Text Input for Recipient 1,
       optional, at 280 by 323 points…"), not by its label — so remember the exact name
       of the field this test creates. The shared draft otherwise holds Signature fields. */
    const textInputs = page.getByRole('button', { name: /^Text Input for Recipient \d+/ });
    let fieldName = '';
    const theField = () => (fieldName ? page.getByRole('button', { name: fieldName, exact: true }) : textInputs.last());

    let draftUrl = '';
    let originalName = '';
    let baseline = 0;

    try {
      await test.step('open the newest draft', async () => {
        await preparePage.goto();
        await preparePage.continueLatestDraft();
        await preparePage.waitForCanvas();
        draftUrl = page.url();
        originalName = await preparePage.currentDocumentName();
        baseline = await preparePage.fieldCount();
      });

      await test.step('find a field with palette search (UF-18)', async () => {
        await preparePage.fieldSearch.fill('text');
        await expect(preparePage.fieldTile('Text Input')).toBeVisible();
        await expect.soft(preparePage.fieldTile('Signature'), 'search should hide non-matching tiles').toBeHidden();
        await preparePage.fieldSearch.fill('');
      });

      await test.step('place a Text Input with the keyboard', async () => {
        const names = () => preparePage.placedFields.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
        const before = new Set(await names());
        await preparePage.placeFieldInMiddle('Text Input');
        await expect.poll(() => preparePage.fieldCount(), { timeout: 10_000 }).toBe(baseline + 1);
        await expect(preparePage.labelInput).toBeVisible();
        fieldName = (await names()).find((n) => !before.has(n)) ?? '';
        expect(fieldName, 'the new field should appear on the canvas').toMatch(/^Text Input for Recipient/);
      });

      await test.step('configure label and placeholder in the inspector', async () => {
        await preparePage.labelInput.fill(label);
        await preparePage.labelInput.press('Tab');
        await preparePage.placeholderInput.fill(placeholder);
        await preparePage.placeholderInput.press('Tab');
        await expect(theField()).toBeVisible();
        await expect.soft(theField(), 'canvas should show the new label').toContainText(label);
        await bugCheckpoint(KNOWN_BUGS.BUG05, () =>
          expect.soft(theField(), 'BUG-05: placeholder should show on the canvas').toContainText(placeholder),
        );
      });

      await test.step('field text is readable on a dark page (BUG-01)', async () => {
        await bugCheckpoint(KNOWN_BUGS.BUG01, () =>
          expectTextReadableOn(theField().locator('span').first(), BLACK, 3, 'field text on a black page').catch((e) => {
            expect.soft(false, (e as Error).message.split('\n')[0]).toBe(true);
          }),
        );
      });

      await test.step('configuration survives a reload (autosave)', async () => {
        /* "autosaved" shows immediately but the PUT is debounced (~0.7 s); let it land. */
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(1_500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await preparePage.waitForCanvas();
        await expect.poll(() => preparePage.fieldCount(), { timeout: 15_000 }).toBe(baseline + 1);
        await theField().click();
        await expect(preparePage.labelInput).toHaveValue(label);
        await expect.soft(preparePage.placeholderInput).toHaveValue(placeholder);
      });

      await test.step('rename the document and see it in the header (UF-21)', async () => {
        const renamed = `${originalName} QA`;
        await preparePage.renameDocumentButton.click();
        await preparePage.documentNameInput.fill(renamed);
        await preparePage.documentNameInput.press('Enter');
        await expect(preparePage.renameDocumentButton).toHaveAttribute('aria-label', `Rename document · ${renamed}`);
        await preparePage.renameDocumentButton.click();
        await preparePage.documentNameInput.fill(originalName);
        await preparePage.documentNameInput.press('Enter');
        await expect(preparePage.renameDocumentButton).toHaveAttribute('aria-label', `Rename document · ${originalName}`);
      });

      await test.step('preview as each recipient (UF-22)', async () => {
        const recipients = await preparePage.recipientCards.count();
        const href = await preparePage.previewLink.getAttribute('href');
        await page.goto(href!, { waitUntil: 'domcontentloaded' });
        await expect(signerPreviewPage.heading).toBeVisible();
        await expect(signerPreviewPage.previewNotice).toBeVisible();
        await expect.soft(signerPreviewPage.previewAsLinks).toHaveCount(recipients);
        /* Signers see a text field as a textbox named "Text Input — <label>". */
        const signerBox = page.getByRole('textbox', { name: new RegExp(`— ${label}$`) });
        await expect.soft(signerBox, 'the new field should be in the signer preview').toBeVisible();
        await expect
          .soft(signerBox, 'signers should see the configured placeholder')
          .toHaveAttribute('placeholder', placeholder);
        await bugCheckpoint(KNOWN_BUGS.BUG03, () =>
          expect.soft(signerPreviewPage.allRecipientsOption, 'BUG-03: no "All recipients" preview').toBeVisible({ timeout: 2_000 }),
        );
        await signerPreviewPage.backToEditingLink.click();
        await expect(page).toHaveURL(/\/prepare/);
        await preparePage.waitForCanvas();
      });

      await test.step('workflow checklist flags the missing recipient e-mail (UF-26)', async () => {
        await preparePage.goToWorkflow();
        await expect(workflowPage.beforeYouSendRegion).toBeVisible();
        if ((await workflowPage.recipientEmail(1).inputValue()) === '') {
          await expect(workflowPage.recipientEmailCheck).toContainText(/email/i);
        }
        await workflowPage.prepareStepButton.click();
        await expect(page).toHaveURL(/\/prepare/);
      });
    } finally {
      await test.step('clean up: remove the field', async () => {
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
        if (draftUrl && !page.url().includes('/prepare')) await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
        await preparePage.waitForCanvas();
        /* Wait until the canvas has rendered every field before deciding what to delete. */
        if (baseline) {
          const counter = await preparePage.fieldCount();
          await expect(preparePage.placedFields).toHaveCount(counter, { timeout: 15_000 });
        }
        for (let guard = 0; guard < 5 && (await textInputs.count()) > 0; guard++) {
          await textInputs.last().click();
          await page.getByRole('button', { name: 'Delete', exact: true }).click();
          await page.waitForTimeout(1_500); // let the debounced save land
        }
        if (baseline) await expect.poll(() => preparePage.fieldCount(), { timeout: 10_000 }).toBe(baseline);
      });
    }
  });
});
