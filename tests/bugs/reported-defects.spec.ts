import { test, expect } from '../../src/fixtures/test';
import { requireData } from '../../src/helpers/precondition';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, UNIQUENESS_TEMPLATE, knownBug, expectOpenBugsToFail } from '../../src/helpers/bugs';
import { BLACK, WHITE, expectErrorStyled, expectTextReadableOn, isErrorColor } from '../../src/helpers/ui';

/**
 * Reproductions of the defects found in the manual session of 16 Nov 2026
 * (docs/TEST_CASES.md §15). Each test asserts the CORRECT behaviour, so it
 * fails while the bug is present and passes once it is fixed.
 *
 * All tests reuse the newest draft envelope (no upload, no quota) and restore
 * anything they change in a `finally` block. Nothing is ever sent.
 */
test.describe('Reported defects — builder, preview and workflow', () => {
  /* In order, one worker (shared draft) — but a failing bug must not skip the others. */
  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ preparePage }) => {
    expectOpenBugsToFail();
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    await preparePage.waitForCanvas();
  });

  test('BUG-01 field text stays readable on a black document page', knownBug(KNOWN_BUGS.BUG01), async ({ preparePage, page }) => {
    let placedHere = false;
    if ((await preparePage.placedFields.count()) === 0) {
      await preparePage.placeFieldInMiddle('Signature');
      placedHere = true;
    }
    try {
      const text = preparePage.placedFields.first().locator('span').first();
      await expect(text).toBeVisible();

      /* Control: the same field is readable on a white page. */
      await expectTextReadableOn(text, WHITE, 3, 'field label on a white page');
      /* The defect: on a black page the near-black label on a 12 % tinted fill disappears. */
      await expectTextReadableOn(text, BLACK, 3, 'field label on a black page');
    } finally {
      if (placedHere) await page.getByRole('button', { name: 'Undo', exact: true }).click();
    }
  });

  test('BUG-02 favourited fields move to the top of the palette', knownBug(KNOWN_BUGS.BUG02), async ({ preparePage }) => {
    const standard = async () => (await preparePage.paletteOrder()).filter((t) => t.name !== 'Payment');
    const before = await standard();
    /* Pick the last tile that is not yet a favourite, so a correct palette must move it up.
       If every field is a favourite, un-favourite the last one first (restored below), so
       the case always runs instead of being skipped. */
    let madeRoom: string | undefined;
    let target = [...before].reverse().find((t) => !t.favourite);
    if (!target) {
      madeRoom = before[before.length - 1].name;
      await preparePage.favouriteToggle(madeRoom).click();
      await expect(preparePage.favouriteToggle(madeRoom)).toHaveAttribute('aria-pressed', 'false');
      target = { name: madeRoom, favourite: false };
    }

    await preparePage.favouriteToggle(target!.name).click();
    try {
      await expect(preparePage.favouriteToggle(target!.name)).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(
          async () => {
            const order = await standard();
            const lastFavourite = order.map((t) => t.favourite).lastIndexOf(true);
            const firstOther = order.findIndex((t) => !t.favourite);
            return firstOther === -1 || lastFavourite < firstOther;
          },
          {
            timeout: 5_000,
            message: `favourites should be listed first; order is ${JSON.stringify(await standard())}`,
          },
        )
        .toBe(true);
    } finally {
      /* Restore the user's favourites (a field we un-favourited stays a favourite). */
      if (!madeRoom) {
        await preparePage.favouriteToggle(target!.name).click();
        await expect(preparePage.favouriteToggle(target!.name)).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });

  test('BUG-03 preview shows the document as every recipient will see it', knownBug(KNOWN_BUGS.BUG03), async ({ preparePage, signerPreviewPage, page }) => {
    const recipients = await preparePage.recipientCards.count();
    expect(recipients, 'draft should have at least one recipient').toBeGreaterThan(0);

    const href = await preparePage.previewLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await expect(signerPreviewPage.heading).toBeVisible();

    /* Each recipient is selectable … */
    await expect.soft(signerPreviewPage.previewAsLinks).toHaveCount(recipients);
    /* … and there is a combined view of what everyone receives. */
    await expect(
      signerPreviewPage.allRecipientsOption,
      'Preview has no "All recipients" view; users can only see one recipient at a time',
    ).toBeVisible({ timeout: 5_000 });
  });

  test('BUG-04 opening another document asks to close the current one', knownBug(KNOWN_BUGS.BUG04), async ({ preparePage, page }) => {
    const originalId = preparePage.documentIdFromUrl();
    /* Search for ANOTHER document: the fixed builder draft's own name matches only itself. */
    const others = ((await (await page.request.get(API.documents)).json()) as { id: string; title: string }[]).filter((d) => d.id !== originalId);
    requireData(others.length > 0, 'the workspace needs a second document to open from the builder (API)');
    const name = others[0].title;

    let nativeWarning = '';
    page.on('dialog', async (d) => {
      nativeWarning = d.message() || d.type();
      await d.dismiss();
    });
    const inAppWarning = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog').filter({ hasText: /close|leave|discard|unsaved|open another/i }));

    /* Open another document from the global search while this one is open. */
    let navigatedTo = originalId;
    for (let skip = 0; skip < 4 && navigatedTo === originalId; skip++) {
      await page.keyboard.press('Control+k');
      const search = page.getByRole('dialog', { name: 'Search your workspace' });
      await expect(search).toBeVisible();
      await search.getByRole('combobox', { name: 'Search' }).fill(name.slice(0, 12));
      const results = search.getByRole('listbox', { name: 'Search results' }).getByRole('option');
      await expect(results.first()).toBeVisible();
      const documents = (await results.count()) - 1; // last option is "See all documents matching …"
      if (skip === 0) requireData(documents >= 1, `global search for "${name.slice(0, 12)}" must return another document to switch to; it returned ${documents}`);
      if (skip >= documents) break;
      await results.nth(skip).click();

      /* Either a warning appears, or we land somewhere. */
      await Promise.race([
        inAppWarning.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined),
        page.waitForURL((u) => !u.pathname.includes(originalId), { timeout: 5_000 }).catch(() => undefined),
      ]);
      if (nativeWarning || (await inAppWarning.first().isVisible().catch(() => false))) break;
      navigatedTo = page.url().match(/\/documents\/([0-9a-f-]+)\//)?.[1] ?? originalId;
      if (navigatedTo === originalId) await page.keyboard.press('Escape');
    }

    const warned = Boolean(nativeWarning) || (await inAppWarning.first().isVisible().catch(() => false));
    expect(
      warned,
      `Opened document ${navigatedTo} while ${originalId} was open in the builder, without any warning to close it`,
    ).toBe(true);
  });

  test('BUG-05 placeholder text is shown on the editing canvas', knownBug(KNOWN_BUGS.BUG05), async ({ preparePage }) => {
    /* A placeholder only applies to typed fields, so the test places its own Text Input
       (the draft's seed fields are Signature, Full Name, Date Signed, Checkbox) and deletes it after. */
    await preparePage.waitForCanvas();
    const before = await preparePage.fieldCount();
    const names = () => preparePage.placedFields.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const existing = new Set(await names());
    const placeholder = `QA placeholder ${Date.now() % 100000}`;
    await preparePage.placeFieldInMiddle('Text Input');
    await expect.poll(() => preparePage.fieldCount(), { timeout: 10_000 }).toBe(before + 1);
    const fieldName = (await names()).find((n) => !existing.has(n));
    expect(fieldName, 'the new Text Input should appear on the canvas').toMatch(/^Text Input for Recipient/);
    const field = preparePage.page.getByRole('button', { name: fieldName!, exact: true });
    try {
      await preparePage.placeholderInput.fill(placeholder);
      await preparePage.placeholderInput.press('Tab');
      await expect(field, 'canvas field should display its placeholder while editing').toContainText(placeholder, {
        timeout: 5_000,
      });
    } finally {
      await preparePage.selectFieldDirect(field);
      await expect(preparePage.page.getByRole('heading', { name: 'Text Input', exact: true }), 'cleanup: the selected field is not our Text Input').toBeVisible();
      await preparePage.page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect.poll(() => preparePage.fieldCount(), { timeout: 10_000, message: 'cleanup left the Text Input on the shared draft' }).toBe(before);
    }
  });

  test('BUG-06 document-name limit error has clear wording in the error colour', knownBug(KNOWN_BUGS.BUG06), async ({ preparePage, page }) => {
    const original = await preparePage.currentDocumentName();
    const tooLong = 'N'.repeat(300);

    await preparePage.renameDocumentButton.click();
    await preparePage.documentNameInput.fill(tooLong);
    await preparePage.documentNameInput.press('Enter');

    try {
      const error = page
        .locator('[role="alert"], .env-field-error, [aria-live] *, [data-tone="danger"], [data-tone="error"]')
        .filter({ hasText: /character|long|limit|name/i })
        .first();
      await expect(error, 'an error must explain the length limit').toBeVisible({ timeout: 5_000 });
      const message = (await error.innerText()).trim();

      /* Observed: the raw validator text "String should have at most 255 characters". */
      expect.soft(message, 'error should name the limit').toMatch(/\b\d+\b.*characters?|characters?.*\b\d+\b/i);
      expect.soft(message, 'error should be user-facing copy about the document name, not raw validator text').toMatch(
        /document name|name/i,
      );
      expect.soft(message, 'raw validator wording leaked to the UI').not.toMatch(/^String should/i);
      await expectErrorStyled(error, `document-name error "${message}"`);
      expect(await preparePage.currentDocumentName().catch(() => tooLong)).not.toBe(tooLong);
    } finally {
      /* Never leave the shared draft renamed. */
      if (await preparePage.documentNameInput.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
      }
      const now = await preparePage.currentDocumentName().catch(() => original);
      if (now !== original) {
        await preparePage.renameDocumentButton.click();
        await preparePage.documentNameInput.fill(original);
        await preparePage.documentNameInput.press('Enter');
        await expect(preparePage.renameDocumentButton).toHaveAttribute('aria-label', `Rename document · ${original}`);
      }
    }
  });

  test('BUG-07 a template name cannot be used twice', knownBug(KNOWN_BUGS.BUG07, ['@data']), async ({ preparePage, documentsPage, page }) => {
    /* One fixed name: while BUG-10 (template delete is a no-op) is open, runs can
       never clean up, so this keeps the pollution capped at two templates. */
    const name = UNIQUENESS_TEMPLATE;
    const draftUrl = page.url();
    const countTemplates = async () => {
      await page.goto('/documents?folder=templates', { waitUntil: 'domcontentloaded' });
      await documentsPage.settle();
      await expect(page.getByRole('heading', { level: 2, name: 'Templates' })).toBeVisible();
      return documentsPage.templateItems(name).count();
    };

    const existing = await countTemplates();
    /* Duplicates left by an earlier run already prove the defect — no new data needed. */
    expect(existing, `${existing} templates are already named "${name}"; names must be unique`).toBeLessThanOrEqual(1);

    await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
    await preparePage.settle();
    const saveTemplate = async () => {
      await preparePage.saveAsTemplateButton.click();
      await expect(preparePage.saveTemplateDialog).toBeVisible();
      await preparePage.templateNameInput.fill(name);
      await preparePage.saveTemplateDialog.getByRole('button', { name: 'Save template' }).click();
    };

    if (existing === 0) {
      await saveTemplate();
      await expect(preparePage.saveTemplateDialog, 'first template should save').toBeHidden({ timeout: 10_000 });
    }

    await saveTemplate();
    const duplicateError = page
      .getByRole('alert')
      .or(preparePage.saveTemplateDialog.locator('.env-field-error'))
      .filter({ hasText: /already|exists|unique|in use|taken|duplicate/i })
      .first();
    const rejected = await duplicateError
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (await preparePage.saveTemplateDialog.isVisible()) await page.keyboard.press('Escape');

    const after = await countTemplates();
    expect.soft(rejected, `saving a second template named "${name}" showed no "already exists" error`).toBe(true);
    expect(after, `${after} templates are named "${name}" after saving a duplicate`).toBe(1);
  });

  test('BUG-10 deleting a template removes it', knownBug(KNOWN_BUGS.BUG10), async ({ documentsPage, page }) => {
    /* Only ever acts on the test-owned uniqueness template, and only when a duplicate exists. */
    await page.goto('/documents?folder=templates', { waitUntil: 'domcontentloaded' });
    await documentsPage.settle();
    const items = documentsPage.templateItems(UNIQUENESS_TEMPLATE);
    const before = await items.count();
    requireData(before >= 2, `two "${UNIQUENESS_TEMPLATE}" templates are needed (left by BUG-07) so one can be deleted safely; found ${before}`);

    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().startsWith(new URL(page.url()).origin)) writes.push(`${r.method()} ${r.url()}`);
    });
    await items.first().getByRole('button', { name: 'More actions' }).click();
    await page
      .getByRole('menu', { name: `Actions for ${UNIQUENESS_TEMPLATE}` })
      .getByRole('menuitem', { name: 'Delete', exact: true })
      .click();
    const confirm = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog'))
      .getByRole('button', { name: /^(Delete|Move to trash|Confirm|Yes)/i });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.first().click();

    await expect(
      items,
      `Delete did nothing: still ${before} templates, ${writes.length} write request(s) sent (${writes.join(', ') || 'none'})`,
    ).toHaveCount(before - 1, { timeout: 10_000 });
  });

  test('BUG-08 missing recipient e-mail is reported as a blocking error', knownBug(KNOWN_BUGS.BUG08), async ({ preparePage, workflowPage }) => {
    await preparePage.goToWorkflow();
    await expect(workflowPage.heading).toBeVisible();
    requireData((await workflowPage.recipientEmail(1).inputValue()) === '', 'recipient 1 of the latest draft already has an e-mail; this check needs a recipient without one');

    const check = workflowPage.recipientEmailCheck;
    await expect(check).toBeVisible();
    const text = (await check.innerText()).replace(/\s+/g, ' ').trim();

    /* Sending is impossible without an address, so this is an error, not an advisory warning. */
    expect.soft(text, 'wording should say the e-mail is required before sending').toMatch(
      /required|must|before (you )?send|can(no|')t send/i,
    );
    const markColor = await check.locator('.env-check-mark, svg').first().evaluate((el) => getComputedStyle(el).color);
    expect(
      isErrorColor(markColor),
      `"${text}" is shown in ${markColor} (warning/amber); a missing recipient must use the error colour`,
    ).toBe(true);
  });

  test('BUG-09 recipients are edited in one place, not inline', knownBug(KNOWN_BUGS.BUG09, ['@ux']), async ({ preparePage, workflowPage }) => {
    await preparePage.goToWorkflow();
    await expect(workflowPage.recipientsRegion).toBeVisible();

    const inlineEditors =
      (await workflowPage.recipientsRegion.getByRole('combobox', { name: /Recipient \d+ email/ }).count()) +
      (await workflowPage.recipientsRegion.getByRole('textbox', { name: /Recipient \d+ name/ }).count());
    expect(
      inlineEditors,
      'Workflow step still edits recipient e-mail/name inline in addition to "Manage recipients"',
    ).toBe(0);
  });
});
