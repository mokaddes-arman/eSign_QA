import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';

const SAMPLE_DOC = path.resolve(__dirname, '../fixtures/sample-agreement.png');

test.describe('New envelope landing', () => {
  test('offers upload, templates and the three-step explainer @smoke', async ({
    preparePage,
  }) => {
    await preparePage.goto();

    await expect(
      preparePage.page.getByRole('heading', { name: 'New envelope', exact: true }),
    ).toBeVisible();
    await expect(
      preparePage.page.getByRole('button', { name: 'Choose a file', exact: true }),
    ).toBeVisible();
    await expect(
      preparePage.page.getByRole('link', { name: /Start from a template/ }),
    ).toBeVisible();
    await expect(preparePage.page.getByText('Choose the document', { exact: true })).toBeVisible();
    await expect(preparePage.page.getByText('Prepare', { exact: true }).first()).toBeVisible();
    await expect(preparePage.page.getByText('Workflow', { exact: true }).first()).toBeVisible();
  });

  test('uploads a file and opens the builder @quota', async ({ preparePage }) => {
    test.skip(
      process.env.RUN_UPLOAD !== 'true',
      'Creates a draft and consumes a free-plan signature request. Set RUN_UPLOAD=true to run.',
    );

    await preparePage.goto();
    await preparePage.upload(SAMPLE_DOC);
    await expect(preparePage.heading).toBeVisible();
  });
});

test.describe('Envelope preparation builder', () => {
  test.beforeEach(async ({ preparePage }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
  });

  test('exposes recipients, field palette and pages @smoke', async ({ preparePage }) => {
    await expect(preparePage.heading).toBeVisible();
    await expect(preparePage.recipientsRegion).toBeVisible();
    await expect(preparePage.fieldPalette).toBeVisible();
    await expect(preparePage.pagesRegion).toBeVisible();
    await expect(preparePage.sendForSignatureButton).toBeVisible();

    for (const field of ['Signature', 'Initials', 'Full Name', 'Date Signed']) {
      await expect(preparePage.fieldTile(field)).toBeVisible();
    }
  });

  test('places a signature field on the page', async ({ preparePage }) => {
    await preparePage.placeFieldInMiddle('Signature');

    await expect(preparePage.page.getByText(/\d+ fields? · autosaved/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(preparePage.inspector).toBeVisible();
  });

  test('moves to the workflow step with routing and delivery options @smoke', async ({
    preparePage,
    workflowPage,
  }) => {
    await preparePage.goToWorkflow();

    await expect(workflowPage.heading).toBeVisible();
    await expect(workflowPage.sequentialButton).toBeVisible();
    await expect(workflowPage.parallelButton).toBeVisible();
    await expect(workflowPage.invitePreview).toBeVisible();
    await expect(workflowPage.beforeYouSend).toBeVisible();
    await expect(workflowPage.reminders).toBeVisible();
    await expect(workflowPage.branding).toBeVisible();
    await expect(workflowPage.deliverySimulation).toBeVisible();
  });
});
