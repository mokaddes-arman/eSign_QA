import { test, expect } from '../../src/fixtures/test';
import { expectErrorStyled, expectStandardUi, trackPageErrors } from '../../src/helpers/ui';

/** Workflow & routing step UI on the newest draft. Nothing is saved or sent. */
test.describe('UI · Workflow step', () => {
  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ preparePage }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    await preparePage.goToWorkflow();
  });

  test('workflow meets the UI baseline', async ({ page, workflowPage }, testInfo) => {
    const errors = trackPageErrors(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(workflowPage.heading).toBeVisible();
    await expectStandardUi(page, testInfo, errors);
  });

  test('empty recipient e-mail shows an inline error in the error colour', async ({ workflowPage }) => {
    test.skip((await workflowPage.recipientEmail(1).inputValue()) !== '', 'Recipient 1 already has an e-mail');
    await workflowPage.saveRecipientEmailButton(1).click();
    await expect(workflowPage.recipientFieldError).toBeVisible();
    await expect(workflowPage.recipientFieldError).toHaveText(/email/i);
    await expectErrorStyled(workflowPage.recipientFieldError, 'recipient e-mail error');
    await expect(workflowPage.recipientEmail(1)).toHaveAttribute('aria-invalid', 'true');
  });

  test('routing toggle exposes exactly one pressed mode', async ({ workflowPage }) => {
    const states = [
      await workflowPage.sequentialButton.getAttribute('aria-pressed'),
      await workflowPage.parallelButton.getAttribute('aria-pressed'),
    ].sort();
    expect(states).toEqual(['false', 'true']);
  });

  test('invite preview reflects the subject line', async ({ workflowPage }) => {
    const subject =
      (await workflowPage.subjectInput.inputValue()) || (await workflowPage.subjectInput.getAttribute('placeholder')) || '';
    await expect(workflowPage.invitePreviewGroup).toContainText(subject.slice(0, 20));
  });

  test('before-you-send checklist items each carry a status icon', async ({ workflowPage }) => {
    const items = workflowPage.beforeYouSendRegion.getByRole('listitem');
    await expect(items.first()).toBeVisible();
    for (let i = 0; i < (await items.count()); i++) {
      await expect(items.nth(i).locator('svg').first()).toBeVisible();
    }
  });
});
