import { test, expect } from '../../src/fixtures/test';
import { optionLabels } from '../../src/helpers/ui';

/**
 * Inspector, recipient manager and workflow option inventories on the newest
 * draft. Fields are only selected and dialogs are cancelled — nothing is saved.
 */
test.describe('Builder details', () => {
  test.describe.configure({ mode: 'default' }); /* in order, one worker; a failure never skips the rest */

  test.beforeEach(async ({ preparePage }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
  });

  test('inspector exposes validation and conditional logic', async ({ page, preparePage }) => {
    /* Fields may overlap; the last one in DOM order is on top and receives the click. */
    const placed = page.getByRole('button', { name: / for Recipient \d+, (required|optional)/ }).last();
    await preparePage.requirePlacedFields();

    await placed.click();
    await expect(page.getByRole('textbox', { name: 'Label' })).toBeVisible();
    /* Also rendered in the selection float-bar, so use the page object's scoped locator. */
    await expect(preparePage.assignedRecipientSelect).toBeVisible();
    for (const dim of ['X', 'Y', 'Width', 'Height']) {
      await expect(page.getByRole('spinbutton', { name: dim, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('switch', { name: 'Required' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Read-only' })).toBeVisible();

    const rules = await optionLabels(page.getByLabel('Validation'));
    expect(rules).toEqual(
      expect.arrayContaining(['None', 'Email', 'Date (MM/DD/YYYY)', 'Numeric', 'Custom regex']),
    );
    const operators = await optionLabels(page.getByLabel('Operator'));
    expect(operators).toEqual(expect.arrayContaining(['is checked', 'equals', 'is not empty']));
  });

  test('manage-recipients dialog offers roles and contact lookup', async ({ preparePage, page }) => {
    await preparePage.manageRecipientsButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Add from contacts' }).first()).toBeVisible();
    const roles = await optionLabels(dialog.getByLabel(/Recipient \d+ role/).first());
    expect(roles).toEqual(
      expect.arrayContaining(['Signer', 'In-person signer', 'Approver', 'Receives a copy']),
    );
    await expect(dialog.getByRole('button', { name: 'Add Recipient' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });

  test('canvas toolbar and pages panel tools are present', async ({ preparePage, page }) => {
    for (const tool of ['Undo', 'Redo', 'Zoom in', 'Zoom out', 'Fit width', 'Fit page', 'Snap grid', 'Duplicate', 'Find fields in the document']) {
      await expect(page.getByRole('button', { name: tool, exact: true })).toBeVisible();
    }
    await expect(preparePage.pagesRegion.getByRole('button', { name: 'Add page' })).toBeVisible();
    for (const action of [preparePage.downloadPdfButton, preparePage.saveAsTemplateButton, preparePage.saveAndCloseButton]) {
      await expect(action).toBeVisible();
    }
  });

  test('workflow offers expiry and payment split options', async ({ preparePage, page }) => {
    await preparePage.goToWorkflow();
    /* Reminder cadence was removed from the workflow step (20 Nov 2026). */
    await expect(page.getByRole('group', { name: 'Reminder cadence' })).toHaveCount(0);
    const expiry = await optionLabels(page.getByLabel('Expires'));
    expect(expiry).toEqual(
      expect.arrayContaining(['After 7 days', 'After 14 days', 'After 30 days', 'After 90 days', 'On a date…']),
    );
    const split = page.getByRole('group', { name: 'Split' });
    for (const option of ['Single payer', 'Split equally', 'Custom split']) {
      await expect(split.getByRole('button', { name: option })).toBeVisible();
    }
    /* Payment collection is blocked until Stripe is connected. */
    await expect(page.getByRole('button', { name: 'Save payment request' })).toBeDisabled();
  });
});
