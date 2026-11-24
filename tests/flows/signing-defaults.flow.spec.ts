import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';
import type { PreparePage } from '../../src/pages/PreparePage';

/**
 * Account-wide defaults that must show up where the user signs or builds:
 *  - UF-40 / BUG-42 — an adopted signature is offered in the signing dialog
 *  - ACC-020 — the organization field palette decides which tiles the builder offers
 * Both change account/organization state, so they run in `chromium-account` (after the builder
 * and the ACC-006 signature flow) and restore it in `finally`.
 */

/** Adopts a typed signature on the profile; returns a remover that deletes exactly that one. */
async function adoptTypedSignature(page: Page): Promise<() => Promise<void>> {
  await page.goto('/account/profile', { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  const region = page.getByRole('region', { name: 'Signatures' });
  const removeButtons = region.getByRole('button', { name: 'Remove' });
  const before = await removeButtons.count();
  const dialog = page.getByRole('dialog', { name: 'Adopt your signature' });
  await clickUntilVisible(region.getByRole('button', { name: 'Add signature' }), dialog);
  await dialog.getByRole('tab', { name: 'Type' }).click();
  await dialog.getByRole('button', { name: 'Adopt signature' }).click();
  await expect(dialog).toBeHidden();
  await expect(removeButtons).toHaveCount(before + 1, { timeout: 20_000 });
  return async () => {
    await page.goto('/account/profile', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    if ((await removeButtons.count()) <= before) return;
    /* A newly adopted signature becomes the Default: remove that entry. */
    const confirm = page.getByRole('dialog', { name: 'Remove this signature?' });
    const own = region.getByText('Default', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Remove"]][1]').getByRole('button', { name: 'Remove' });
    await clickUntilVisible(own, confirm);
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(removeButtons).toHaveCount(before, { timeout: 20_000 });
  };
}

/** Opens the builder draft's signer preview and the signing dialog. */
async function openSigningDialog(preparePage: PreparePage, page: Page) {
  await preparePage.goto();
  await preparePage.continueLatestDraft();
  await page.goto((await preparePage.previewLink.getAttribute('href'))!, { waitUntil: 'domcontentloaded' });
  await preparePage.settle();
  const dialog = page.getByRole('dialog', { name: 'Adopt your signature' });
  await clickUntilVisible(page.getByRole('button', { name: 'Start signing' }), dialog);
  return dialog;
}

test.describe('Flow · Signing defaults @flow', () => {
  test('UF-40 an adopted signature is offered when signing and signs the field @data', async ({ preparePage, page }) => {
    const remove = await adoptTypedSignature(page);
    try {
      const dialog = await openSigningDialog(preparePage, page);
      await dialog.getByRole('tab', { name: 'Saved / Passkey' }).click();
      const saved = dialog.getByRole('button', { name: /Adopted \d{1,2} \w{3} \d{4}\s+typed$/ });
      await expect(saved, 'the adopted signature is listed under Saved').toHaveCount(1);
      const signer = (await saved.innerText()).split('\n')[0].trim();
      await saved.click();
      await dialog.getByRole('button', { name: 'Adopt and sign' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: /^Signature — .+\(required\)/ })).toContainText(signer);
      await expect(page.getByText(/^\d+ of \d+ required fields completed$/)).toHaveText(/^(\d+) of \1 required fields completed$/);
    } finally {
      await remove();
    }
  });

  test('BUG-42 the signing dialog opens on the saved default signature', knownBug(KNOWN_BUGS.BUG42, ['@data']), async ({ preparePage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const remove = await adoptTypedSignature(page);
    try {
      const dialog = await openSigningDialog(preparePage, page);
      await expect(dialog.getByRole('tab', { name: 'Saved / Passkey' }), 'the profile promises the default is offered first').toHaveAttribute('aria-selected', 'true');
    } finally {
      await remove();
    }
  });

  test('ACC-020 a type removed from the organization palette disappears from the builder, and returns @data', async ({ preparePage, page }) => {
    const TYPE = 'Stamp';
    const palette = page.getByRole('group', { name: 'Field types offered in the builder palette' });
    const box = palette.getByRole('checkbox', { name: TYPE, exact: true });
    const save = async () => {
      const saved = page.waitForResponse((r) => r.request().method() !== 'GET' && /palette|field-types|organization/i.test(r.url()), { timeout: 20_000 });
      await page.getByRole('button', { name: 'Save palette' }).click();
      expect((await saved).ok(), 'saving the palette failed').toBe(true);
    };
    const openOrg = async () => {
      await page.goto('/account/organization', { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      await expect(palette.getByRole('checkbox')).toHaveCount(16);
    };

    await openOrg();
    await expect(box, `${TYPE} must be offered before the test`).toBeChecked();
    try {
      await box.uncheck();
      await save();
      await openOrg();
      await expect(box, 'the palette change persists').not.toBeChecked();

      await preparePage.goto();
      await preparePage.continueLatestDraft();
      await expect(preparePage.fieldTile(TYPE), `${TYPE} must no longer be offered in the builder`).toHaveCount(0);
      await expect(preparePage.fieldTile('Signature')).toBeVisible();
    } finally {
      await openOrg();
      if (!(await box.isChecked())) {
        await box.check();
        await save();
      }
    }
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    await expect(preparePage.fieldTile(TYPE), `${TYPE} is offered again once re-ticked`).toBeVisible();
  });
});
