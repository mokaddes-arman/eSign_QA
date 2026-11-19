import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { requireData } from '../helpers/precondition';

/** /documents/{id}/prepare — field placement builder. */
export class PreparePage extends BasePage {
  protected readonly path = '/documents/prepare';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Prepare document' });
  readonly fileInput = this.page.locator('input[type=file]').first();
  readonly sendForSignatureButton = this.healButton('Send for signature', false);
  readonly continueButton = this.healButton('Continue');
  readonly workflowButton = this.healButton('Workflow');
  readonly previewLink = this.page.getByRole('link', { name: 'Preview' });
  readonly downloadPdfButton = this.healButton('Download PDF', false);
  readonly saveAsTemplateButton = this.healButton('Save as template', false);
  readonly saveAndCloseButton = this.healButton('Save and close', false);

  readonly recipientsRegion = this.page.getByRole('region', { name: 'Recipients' });
  readonly addRecipientButton = this.recipientsRegion.getByRole('button', { name: 'Add recipient' });
  readonly manageRecipientsButton = this.recipientsRegion.getByRole('button', { name: 'Manage recipients' });

  readonly fieldPalette = this.page.getByRole('region', { name: 'Field palette' });
  readonly fieldSearch = this.fieldPalette.getByRole('searchbox', { name: 'Search fields' });
  readonly pagesRegion = this.page.getByRole('region', { name: 'Pages' });
  readonly inspector = this.healButton('Hide Inspector', false);

  /* Header */
  readonly fieldCounter = this.page.getByText(/^\d+ fields? · autosaved$/);
  readonly renameDocumentButton = this.page.getByRole('button', { name: /^Rename document · / });
  readonly documentNameInput = this.page.getByRole('textbox', { name: 'Document name' });

  /* Palette */
  readonly allFieldsTab = this.fieldPalette.getByRole('button', { name: 'All fields', exact: true });
  readonly favouritesTab = this.fieldPalette.getByRole('button', { name: 'Favourites', exact: true });
  /** Every placeable tile in the palette, in on-screen order. */
  readonly paletteTiles = this.fieldPalette.getByRole('button', {
    name: /^Place .+ — drag onto the page|^Pick the pen up/,
  });

  /* Canvas */
  readonly placedFields = this.page.getByRole('button', { name: / for Recipient \d+, (required|optional)/ });
  readonly documentLoading = this.page.getByText('Loading the document…');

  /* Inspector (visible once a field is selected) */
  readonly labelInput = this.page.getByRole('textbox', { name: 'Label', exact: true });
  readonly placeholderInput = this.page.getByRole('textbox', { name: 'Placeholder', exact: true });
  /* Rendered twice (inspector + a hidden copy); the first is the inspector's. */
  readonly assignedRecipientSelect = this.page.getByRole('combobox', { name: 'Assigned recipient' }).first();

  /* Dialogs */
  readonly recipientsDialog = this.page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
  readonly saveTemplateDialog = this.page.getByRole('dialog', { name: 'Save as template' });
  readonly templateNameInput = this.saveTemplateDialog.getByRole('textbox', { name: 'Template name' });

  fieldTile(name: string) {
    return this.fieldPalette.getByRole('button', { name: new RegExp(`^Place ${name}`) });
  }

  /** The star toggle next to a palette tile ("Add X to favourites" / "Remove X from favourites"). */
  favouriteToggle(name: string) {
    return this.fieldPalette.getByRole('button', {
      name: new RegExp(`^(Add ${name} to|Remove ${name} from) favourites$`),
    });
  }

  /** Palette tile names in on-screen order, each flagged as favourite or not. */
  async paletteOrder(): Promise<{ name: string; favourite: boolean }[]> {
    return this.fieldPalette.evaluate((root) => {
      const out: { name: string; favourite: boolean }[] = [];
      for (const btn of root.querySelectorAll('button[aria-label]')) {
        const label = btn.getAttribute('aria-label') || '';
        const m = label.match(/^(Add (.+) to|Remove (.+) from) favourites$/);
        if (m) out.push({ name: (m[2] || m[3]).trim(), favourite: label.startsWith('Remove') });
      }
      return out;
    });
  }

  async fieldCount(): Promise<number> {
    await expect(this.fieldCounter).toBeVisible({ timeout: 15_000 });
    return Number((await this.fieldCounter.innerText()).match(/^\d+/)![0]);
  }

  /**
   * Precondition for tests that need placed fields. The builder's own counter
   * ("N fields · autosaved") decides whether the draft has fields — so a broken
   * canvas locator FAILS the test instead of looking like "no data" and skipping.
   */
  async requirePlacedFields(): Promise<number> {
    await this.waitForCanvas();
    const n = await this.fieldCount();
    requireData(n > 0, 'the latest draft has no placed fields (builder counter shows 0 fields)');
    await expect(
      this.placedFields.first(),
      `The builder reports ${n} placed field(s) but none was found on the canvas (field locator out of date?)`,
    ).toBeVisible({ timeout: 15_000 });
    return n;
  }

  /**
   * Selects a placed field even when another field overlaps it. Placed fields stack, so a
   * pointer click at the field's centre can land on (and select) the field on top; the
   * events are dispatched to the element itself instead.
   */
  async selectFieldDirect(field: Locator): Promise<void> {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) await field.dispatchEvent(type);
  }

  async waitForCanvas(): Promise<void> {
    await this.documentLoading.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  }

  /** Recipient cards in the Recipients panel, e.g. "1 Recipient 1 Pending Needs to sign · 6 fields". */
  readonly recipientCards = this.recipientsRegion.getByRole('button', { name: /^\d+ .+ · \d+ fields?$/ });

  async selectField(index: 'first' | 'last' = 'last') {
    await this.waitForCanvas();
    const field = index === 'first' ? this.placedFields.first() : this.placedFields.last();
    await this.selectFieldDirect(field); /* fields overlap; a pointer click may hit another one */
    await expect(this.labelInput).toBeVisible();
    return field;
  }

  async currentDocumentName(): Promise<string> {
    const label = (await this.renameDocumentButton.getAttribute('aria-label')) || '';
    return label.replace(/^Rename document · /, '');
  }

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(
      this.page.getByRole('heading', { name: 'New envelope', exact: true }),
    ).toBeVisible();
  }

  async openDraft(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
  }

  /**
   * Opens the newest existing draft from the "New envelope" landing page.
   * Builder tests use this instead of uploading, so a run never spends the
   * workspace's monthly signature-request quota.
   */
  async continueLatestDraft(): Promise<void> {
    const link = this.page.getByRole('link', { name: /Continue your most recent draft/ });
    await expect(link).toBeVisible({ timeout: 15_000 });
    /* Navigate by href: a click before hydration is silently dropped. */
    const href = await link.getAttribute('href');
    if (href) await this.page.goto(href, { waitUntil: 'domcontentloaded' });
    else await link.click();
    await expect(this.page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/);
    await expect(this.heading).toBeVisible();
    await this.settle();
  }

  async upload(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await expect(this.page).toHaveURL(/\/documents\/[0-9a-f-]+\/prepare/, { timeout: 30_000 });
    await expect(this.heading).toBeVisible();
  }

  async placeFieldInMiddle(name: string): Promise<void> {
    await this.fieldTile(name).focus();
    await this.fieldTile(name).press('Enter');
  }

  async goToWorkflow(): Promise<void> {
    await this.workflowButton.click();
    await expect(this.page).toHaveURL(/\/workflow/);
  }

  documentIdFromUrl(): string {
    const match = this.page.url().match(/\/documents\/([0-9a-f-]+)\//);
    if (!match) throw new Error(`No document id in URL: ${this.page.url()}`);
    return match[1];
  }
}
