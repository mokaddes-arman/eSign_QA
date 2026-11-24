import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';
import { BUILDER_DRAFT } from '../../src/helpers/builderDraft';
import { clickUntilVisible } from '../../src/helpers/wait';
import type { PreparePage } from '../../src/pages/PreparePage';

/**
 * Builder and workflow behaviour on the fixed "QA Builder draft" (helpers/builderDraft.ts):
 * every control is used and its outcome checked — persisted after a reload, enforced in the
 * signer preview, or reflected elsewhere — then reverted in `finally`.
 * Runs in `chromium-builder` (one worker, in order), so nothing else edits the draft meanwhile.
 */

/** Seed recipient added and removed by the recipient tests (example.com: no mailbox receives anything). */
const SECOND_EMAIL = 'qa.recipient2@example.com';

/** The 16 field types the organization palette offers (account/organization). */
const FIELD_TYPES = [
  'Signature', 'Initials', 'Date and Time', 'Date Signed', 'Full Name', 'Email', 'Text Input', 'Checkbox',
  'Radio Group', 'Dropdown', 'Stamp', 'Attachment', 'Number', 'Payment', 'Text Box', 'Pen Drawing',
];

/* "<Type> for <recipient name>, required|optional, at …" — the recipient may be renamed or derived from an e-mail. */
const fieldOf = (page: Page, type: string) => page.getByRole('button', { name: new RegExp(`^${type} for .+?, (required|optional), `) });
const fieldLabels = (page: Page) =>
  page.getByRole('button', { name: / for Recipient \d+, (required|optional)/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '').sort());

async function selectType(preparePage: PreparePage, type: string): Promise<void> {
  await preparePage.selectFieldDirect(fieldOf(preparePage.page, type));
  await expect(preparePage.page.getByRole('heading', { level: 2, name: type, exact: true })).toBeVisible();
}

/** The builder autosaves on a debounce (FEATURES O13): let the last save reach the server. */
async function settleAutosave(page: Page): Promise<void> {
  await page.waitForTimeout(1_500);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}

async function reloadBuilder(preparePage: PreparePage): Promise<void> {
  await preparePage.page.reload({ waitUntil: 'domcontentloaded' });
  await expect(preparePage.heading).toBeVisible();
  await preparePage.settle();
  await preparePage.waitForCanvas();
}

async function apiDocument(page: Page, id: string) {
  return (await (await page.request.get(API.document(id))).json()) as { title: string; workflow_type: string; expires_in_days: number; recipients_total: number };
}

const recipientCards = (page: Page) => page.getByRole('region', { name: 'Recipients' }).getByRole('button', { name: /^\d+ .+ · \d+ fields?$/ });
const cardTexts = async (page: Page) => (await recipientCards(page).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

/* The recipient manager labels a recipient by role_name ("Recipient 2", or the name typed there); the cards use name. */
type ApiRecipient = { id: string; name: string; role_name: string; email: string; created_at: string };
const apiRecipients = async (page: Page, id: string) => (await (await page.request.get(`${API.document(id)}/recipients`)).json()) as ApiRecipient[];

/**
 * Removes, through Manage recipients, every recipient that is not in `keep` (ids from the
 * recipients API), so a test leaves the draft with exactly the recipients it started with.
 */
async function restoreRecipients(preparePage: PreparePage, draftId: string, keep: string[]): Promise<void> {
  const page = preparePage.page;
  const extra = async () => (await apiRecipients(page, draftId)).filter((r) => !keep.includes(r.id));
  if ((await extra()).length === 0) return;
  await page.goto(`/documents/${draftId}/prepare`, { waitUntil: 'domcontentloaded' });
  await expect(preparePage.heading).toBeVisible();
  await preparePage.settle();
  const dialog = page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
  await page.getByRole('button', { name: 'Manage recipients' }).click();
  await expect(dialog).toBeVisible();
  for (const r of await extra()) {
    const remove = dialog.getByRole('button', { name: `Remove ${r.role_name || r.name}`, exact: true });
    await remove.click();
    await page.getByRole('dialog', { name: /^Remove .+\?$/ }).getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(remove).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: 'Save and Continue' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await extra()).length, { timeout: 15_000, message: 'cleanup left an added recipient on the draft' }).toBe(0);
}

/** Adds SECOND_EMAIL as a new, last recipient in Manage recipients (dialog left open). */
async function addSecondRecipient(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
  await page.getByRole('button', { name: 'Manage recipients' }).click();
  await expect(dialog).toBeVisible();
  const roles = dialog.getByRole('combobox', { name: / role$/ });
  const before = await roles.count();
  await dialog.getByRole('button', { name: 'Add Recipient' }).click();
  await expect(roles).toHaveCount(before + 1);
  /* The new recipient is the last one, and the only one whose e-mail is still an input. */
  const email = dialog.getByRole('combobox', { name: /^Recipient \d+ email$/ }).last();
  await email.fill(SECOND_EMAIL);
  await email.press('Enter');
  await expect(dialog.getByText(SECOND_EMAIL, { exact: true })).toHaveCount(1);
  return dialog;
}

test.describe('Builder behaviour', () => {
  test.describe.configure({ mode: 'default' }); /* in order, one worker; a failure never skips the rest */

  test.beforeEach(async ({ preparePage, page }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    /* An interrupted earlier run may have left extra recipients: keep only the seed (the oldest). */
    const id = preparePage.documentIdFromUrl();
    const recipients = await apiRecipients(page, id);
    if (recipients.length > 1) {
      const seed = [...recipients].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      await restoreRecipients(preparePage, id, [seed.id]);
      await reloadBuilder(preparePage);
    }
  });

  test('PREP-003 recipients panel shows each recipient with status, role and their field count', async ({ preparePage, page }) => {
    const cards = recipientCards(page);
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.getByRole('main')).toContainText(new RegExp(`\\d+ pages? · ${count} recipients?`));
    for (let i = 0; i < count; i++) {
      const text = (await cards.nth(i).innerText()).replace(/\s+/g, ' ').trim();
      const [, position, name, status, role, fields] = text.match(/^(\d+) (.+) (Pending|Signed|Declined|Completed) (.+) · (\d+) fields?$/) ?? [];
      expect(position, `card "${text}"`).toBe(String(i + 1));
      expect(['Needs to sign', 'In-person signer', 'Approver', 'Receives a copy', 'Signer']).toContain(role);
      /* The card's field count equals the fields on the canvas assigned to that recipient. */
      const onCanvas = await page.getByRole('button', { name: new RegExp(` for ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, (required|optional)`) }).count();
      expect(Number(fields), `${name}: card says ${fields} field(s), canvas has ${onCanvas}`).toBe(onCanvas);
      expect(status).toBe('Pending');
    }
    /* Selecting a card marks it as the active recipient. */
    await cards.first().click();
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
    /* "Manage Recipient 1" opens the recipient manager on that recipient. */
    const first = (await cards.first().innerText()).split('\n')[1].trim();
    await page.getByRole('button', { name: `Manage ${first}` }).click();
    const dialog = page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
    await expect(dialog.getByRole('button', { name: `Rename ${first}` })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    expect(await preparePage.fieldCount()).toBeGreaterThan(0);
  });

  test('PREP-005 UF-17 recipients added, re-ordered and given a role persist and update the cards and workflow', async ({ preparePage, page }) => {
    const before = await cardTexts(page);
    const draftId = preparePage.documentIdFromUrl();
    const keep = (await apiRecipients(page, draftId)).map((r) => r.id);
    try {
      const dialog = await addSecondRecipient(page);
      await dialog.getByRole('combobox', { name: /role$/ }).last().selectOption({ label: 'Approver' });
      await dialog.getByRole('button', { name: /^Move .+ up$/ }).last().click();
      await dialog.getByRole('button', { name: 'Save and Continue' }).click();
      await expect(dialog).toBeHidden();
      await settleAutosave(page);

      /* After a reload the new recipient is first, an Approver with no fields; the others follow. */
      await reloadBuilder(preparePage);
      const after = await cardTexts(page);
      expect(after, 'one more recipient card').toHaveLength(before.length + 1);
      expect(after[0]).toMatch(/^1 .+ Pending Approver · 0 fields$/);
      expect(after.slice(1).map((t) => t.replace(/^\d+ /, '')), 'the existing recipients keep their order after the new one').toEqual(before.map((t) => t.replace(/^\d+ /, '')));
      await expect(page.getByRole('main')).toContainText(`· ${before.length + 1} recipients`);

      /* The workflow step lists the same order, with the e-mail and role. */
      await preparePage.goToWorkflow();
      const routing = page.getByRole('region', { name: 'Recipients & signing order' });
      await expect(routing.getByText(SECOND_EMAIL)).toBeVisible();
      await expect(routing.getByRole('combobox', { name: 'Role' }).first()).toHaveValue(/approve/i);
      await expect(routing.getByRole('button', { name: /^Remove / })).toHaveCount(before.length + 1);
    } finally {
      await restoreRecipients(preparePage, draftId, keep);
    }
    await page.goto(`/documents/${draftId}/prepare`, { waitUntil: 'domcontentloaded' });
    await expect(preparePage.heading).toBeVisible();
    await preparePage.waitForCanvas();
    expect(await cardTexts(page), 'removing the recipient restores the original cards').toEqual(before);
  });

  test('BUG-43 a recipient renamed in Manage recipients keeps that name on the cards and in the workflow', knownBug(KNOWN_BUGS.BUG43, ['@data']), async ({ preparePage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const name = 'QA Second';
    const draftId = preparePage.documentIdFromUrl();
    const keep = (await apiRecipients(page, draftId)).map((r) => r.id);
    try {
      const dialog = await addSecondRecipient(page);
      await dialog.getByRole('button', { name: /^Rename / }).last().click();
      const input = dialog.getByRole('textbox', { name: 'Recipient name' });
      await input.fill(name);
      await input.press('Enter');
      await expect(dialog.getByRole('button', { name: `Rename ${name}` })).toBeVisible();
      await dialog.getByRole('button', { name: 'Save and Continue' }).click();
      await expect(dialog).toBeHidden();
      await settleAutosave(page);
      await reloadBuilder(preparePage);
      expect((await cardTexts(page)).some((t) => t.includes(` ${name} `)), `cards: ${(await cardTexts(page)).join(' | ')}`).toBe(true);
    } finally {
      await restoreRecipients(preparePage, draftId, keep);
    }
  });

  test('PREP-008 a field assigned to another recipient moves to that recipient’s card and persists', async ({ preparePage, page }) => {
    const draftId = preparePage.documentIdFromUrl();
    const keep = (await apiRecipients(page, draftId)).map((r) => r.id);
    const firstCard = (await cardTexts(page))[0];
    const firstFields = Number(firstCard.match(/(\d+) fields?$/)![1]);
    try {
      const failedSaves: string[] = [];
      page.on('response', async (r) => {
        if (r.request().method() === 'PUT' && /\/fields$/.test(r.url()) && r.status() >= 400) failedSaves.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 200)}`);
      });
      const dialog = await addSecondRecipient(page);
      await dialog.getByRole('button', { name: 'Save and Continue' }).click();
      await expect(dialog).toBeHidden();
      /* Start from server state: the new recipient must exist with its real id before a field is given to it. */
      await expect.poll(async () => (await apiRecipients(page, draftId)).length, { timeout: 15_000 }).toBe(keep.length + 1);
      await reloadBuilder(preparePage);
      test.info().annotations.push({ type: 'note', description: 'Reassigning immediately after adding a recipient once produced a failed field save; the test now waits for the saved recipient.' });

      await selectType(preparePage, 'Checkbox');
      const options = await preparePage.assignedRecipientSelect.evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.text));
      const other = options.find((o) => o !== 'Recipient 1' && !o.startsWith('+'));
      expect(other, `the new recipient should be offered (options: ${options.join(', ')})`).toBeTruthy();
      await preparePage.assignedRecipientSelect.selectOption({ label: other! });
      await expect(fieldOf(page, 'Checkbox')).toHaveAttribute('aria-label', new RegExp(`^Checkbox for ${other!.replace(/[()]/g, '\\$&')}, `));
      /* Autosave is debounced: wait until the server holds the new assignment before reloading. */
      const seedId = keep[0];
      const checkboxOwner = async () => ((await (await page.request.get(`${API.document(draftId)}/fields`)).json()) as { type: string; recipient_id: string }[]).find((f) => f.type === 'checkbox')?.recipient_id;
      await expect.poll(checkboxOwner, { timeout: 20_000, message: 'the reassignment was not saved' }).not.toBe(seedId);
      expect(failedSaves, 'field saves rejected by the server').toEqual([]);

      await reloadBuilder(preparePage);
      const cards = await cardTexts(page);
      expect(cards[0], 'Recipient 1 loses the field').toMatch(new RegExp(`· ${firstFields - 1} fields?$`));
      /* The card says "1 fields" — a plural slip, recorded as an observation. */
      expect(cards[1], 'the new recipient gains it').toMatch(/· 1 fields?$/);
      if (/· 1 fields$/.test(cards[1])) test.info().annotations.push({ type: 'observation', description: `Recipient card reads "${cards[1]}".` });
      await expect(fieldOf(page, 'Checkbox'), 'the assignment persists').not.toHaveAttribute('aria-label', /^Checkbox for Recipient 1, /);
    } finally {
      /* Give the field back before removing the recipient, so the seed field survives. */
      await page.goto(`/documents/${draftId}/prepare`, { waitUntil: 'domcontentloaded' });
      await preparePage.waitForCanvas();
      await selectType(preparePage, 'Checkbox');
      await preparePage.assignedRecipientSelect.selectOption({ label: 'Recipient 1' });
      const owner = async () => ((await (await page.request.get(`${API.document(draftId)}/fields`)).json()) as { type: string; recipient_id: string }[]).find((f) => f.type === 'checkbox')?.recipient_id;
      await expect.poll(owner, { timeout: 20_000, message: 'cleanup: the Checkbox was not given back to Recipient 1' }).toBe(keep[0]);
      await restoreRecipients(preparePage, draftId, keep);
    }
    await page.goto(`/documents/${draftId}/prepare`, { waitUntil: 'domcontentloaded' });
    await preparePage.waitForCanvas();
    expect((await cardTexts(page))[0]).toBe(firstCard);
  });

  /** Adds a new recipient picked from the address book; returns the contact and the saved recipient. */
  async function addFromContacts(preparePage: PreparePage, draftId: string) {
    const page = preparePage.page;
    const { items } = (await (await page.request.get(API.contacts)).json()) as { items: { name: string; email: string }[] };
    const contact = items.find((c) => c.email === 'qa.contact.recipient-check@example.com') ?? items.find((c) => /^QA Contact/.test(c.name));
    expect(contact, 'a QA contact is needed (the contacts flows keep fixed records)').toBeTruthy();
    const dialog = page.getByRole('dialog', { name: /Add recipients that need to fill out/ });
    await page.getByRole('button', { name: 'Manage recipients' }).click();
    const pickers = dialog.getByRole('button', { name: 'Add from contacts' });
    const before = await pickers.count();
    await dialog.getByRole('button', { name: 'Add Recipient' }).click();
    await expect(pickers, 'the new recipient row').toHaveCount(before + 1);
    /* The new recipient's own "Add from contacts" lists the address book under its e-mail box
       (a click right after the row appears can be dropped, so retry until the list opens). */
    const list = dialog.getByRole('listbox', { name: 'Matching contacts' });
    await clickUntilVisible(pickers.last(), list, { what: '"Add from contacts" did not open the contact list' });
    const option = list.getByRole('option').filter({ hasText: contact!.email });
    await expect(option, 'the contact is offered').toHaveCount(1);
    await option.click();
    await expect(dialog.getByText(contact!.email, { exact: true }), 'the e-mail is filled from the contact').toBeVisible();
    await dialog.getByRole('button', { name: 'Save and Continue' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await apiRecipients(page, draftId)).some((r) => r.email === contact!.email), { message: 'the recipient is saved with the contact’s e-mail' }).toBe(true);
    return { contact: contact!, saved: (await apiRecipients(page, draftId)).find((r) => r.email === contact!.email)! };
  }

  test('PREP-017 a recipient added from contacts is prefilled with the contact’s e-mail and listed', async ({ preparePage, page }) => {
    const draftId = preparePage.documentIdFromUrl();
    const keep = (await apiRecipients(page, draftId)).map((r) => r.id);
    try {
      const { saved } = await addFromContacts(preparePage, draftId);
      await reloadBuilder(preparePage);
      expect(await cardTexts(page), 'the new recipient gets a card').toHaveLength(keep.length + 1);
      await preparePage.goToWorkflow();
      await expect(page.getByRole('region', { name: 'Recipients & signing order' }).getByText(saved.email)).toBeVisible();
    } finally {
      await restoreRecipients(preparePage, draftId, keep);
    }
  });

  test('BUG-47 a recipient added from contacts takes the contact’s name', knownBug(KNOWN_BUGS.BUG47, ['@data']), async ({ preparePage, page }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    const draftId = preparePage.documentIdFromUrl();
    const keep = (await apiRecipients(page, draftId)).map((r) => r.id);
    try {
      const { contact, saved } = await addFromContacts(preparePage, draftId);
      expect(saved.name, `picked "${contact.name}" from contacts`).toBe(contact.name);
    } finally {
      await restoreRecipients(preparePage, draftId, keep);
    }
  });

  test('PREP-006 field palette offers all 16 field types, each placeable', async ({ preparePage }) => {
    const names = await preparePage.fieldPalette.evaluate((root) =>
      [...root.querySelectorAll('button[aria-label]')]
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter((l) => /^Place .+ — drag onto the page|^Pick the pen up/.test(l))
        .map((l) => (l.startsWith('Pick the pen') ? 'Pen Drawing' : l.replace(/^Place (.+?) — .*/, '$1'))),
    );
    expect([...names].sort(), 'palette tiles vs the 16 field types').toEqual([...FIELD_TYPES].sort());
    /* Every tile can be placed from the keyboard (Pen Drawing is drawn, not placed). */
    for (const tile of FIELD_TYPES.filter((t) => t !== 'Pen Drawing')) {
      await expect(preparePage.fieldTile(tile)).toBeEnabled();
    }
    /* Searching narrows the palette to matching tiles. */
    await preparePage.fieldSearch.fill('date');
    await expect(preparePage.fieldTile('Date Signed')).toBeVisible();
    await expect(preparePage.fieldTile('Date and Time')).toBeVisible();
    await expect(preparePage.fieldTile('Signature')).toBeHidden();
    await preparePage.fieldSearch.fill('');
  });

  test('PREP-009 required and validation rules persist and are enforced for the signer', async ({ preparePage, page }) => {
    const draftUrl = page.url();
    try {
      await selectType(preparePage, 'Full Name');
      await page.getByRole('switch', { name: 'Required' }).click();
      await expect(page.getByRole('switch', { name: 'Required' })).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('combobox', { name: 'Validation' }).selectOption({ label: 'Email' });
      await expect(page.locator('code').filter({ hasText: '@' }).first()).toBeVisible();
      await settleAutosave(page);

      await reloadBuilder(preparePage);
      await selectType(preparePage, 'Full Name');
      await expect(page.getByRole('switch', { name: 'Required' }), 'Required did not persist').toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('combobox', { name: 'Validation' }), 'Validation did not persist').toHaveValue('email');
      await expect(fieldOf(page, 'Full Name')).toHaveAttribute('aria-label', /, required,/);

      /* Signer preview: the field now counts as required and rejects a non-e-mail. */
      await page.goto((await preparePage.previewLink.getAttribute('href'))!, { waitUntil: 'domcontentloaded' });
      const progress = page.getByText(/^\d+ of \d+ required fields completed$/);
      await expect(progress).toHaveText(`0 of 2 required fields completed`);
      const input = page.getByRole('textbox', { name: /^Full Name — / });
      await input.fill('not-an-email');
      await input.blur();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert').filter({ hasText: 'Enter an email address, like name@company.com' })).toBeVisible();
      await expect(progress).toHaveText('0 of 2 required fields completed');
      await input.fill('qa.signer@example.com');
      await input.blur();
      await expect(input).not.toHaveAttribute('aria-invalid', 'true');
      await expect(progress).toHaveText('1 of 2 required fields completed');
    } finally {
      await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
      await preparePage.waitForCanvas();
      await selectType(preparePage, 'Full Name');
      if ((await page.getByRole('switch', { name: 'Required' }).getAttribute('aria-checked')) === 'true') await page.getByRole('switch', { name: 'Required' }).click();
      await page.getByRole('combobox', { name: 'Validation' }).selectOption({ label: 'None' });
      await settleAutosave(page);
    }
    await reloadBuilder(preparePage);
    await expect(fieldOf(page, 'Full Name'), 'revert: Full Name should be optional again').toHaveAttribute('aria-label', /, optional,/);
  });

  test('PREP-010 conditional logic hides a field until its trigger is met, in the signer preview', async ({ preparePage, page }) => {
    const draftUrl = page.url();
    try {
      await selectType(preparePage, 'Full Name');
      await page.getByRole('combobox', { name: 'Trigger field' }).selectOption({ label: 'Checkbox (Checkbox)' });
      await page.getByRole('combobox', { name: 'Operator' }).selectOption({ label: 'is checked' });
      await expect(page.getByText('Show “Full Name” only when “Checkbox” is checked.')).toBeVisible();
      await settleAutosave(page);

      await reloadBuilder(preparePage);
      await selectType(preparePage, 'Full Name');
      await expect(page.getByRole('combobox', { name: 'Trigger field' }).locator('option:checked'), 'the condition did not persist').toHaveText('Checkbox (Checkbox)');

      await page.goto((await preparePage.previewLink.getAttribute('href'))!, { waitUntil: 'domcontentloaded' });
      const fullName = page.getByRole('textbox', { name: /^Full Name — / });
      const checkbox = page.getByRole('checkbox', { name: /^Checkbox — / });
      await expect(checkbox).toBeVisible();
      await expect(fullName, 'hidden while the checkbox is clear').toBeHidden();
      /* The seed fields overlap on the page, so toggle the checkbox from the keyboard. */
      await checkbox.focus();
      await page.keyboard.press('Space');
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await expect(fullName, 'shown once the checkbox is ticked').toBeVisible();
      await checkbox.focus();
      await page.keyboard.press('Space');
      await expect(checkbox).toHaveAttribute('aria-checked', 'false');
      await expect(fullName, 'hidden again when the checkbox is cleared').toBeHidden();
    } finally {
      await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
      await preparePage.waitForCanvas();
      await selectType(preparePage, 'Full Name');
      await page.getByRole('combobox', { name: 'Trigger field' }).selectOption({ index: 0 });
      await settleAutosave(page);
    }
    await reloadBuilder(preparePage);
    await selectType(preparePage, 'Full Name');
    await expect(page.getByRole('combobox', { name: 'Trigger field' }).locator('option:checked')).toHaveText('— always show —');
  });

  test('PREP-011 UF-20 pages can be added, re-ordered and deleted; thumbnails follow their fields', async ({ preparePage, page }) => {
    const pages = preparePage.pagesRegion;
    const thumbs = async () => (await pages.getByRole('button', { name: /^Go to page/ }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const original = await thumbs();
    expect(original, 'the builder draft is a one-page document').toHaveLength(1);
    const fields = await preparePage.fieldCount();
    const onPage1 = original[0];
    try {
      await pages.getByRole('button', { name: 'Add page' }).click();
      await pages.getByRole('button', { name: 'Blank page' }).click();
      await expect.poll(thumbs, { timeout: 30_000 }).toEqual([onPage1, 'Page 2 no fields']);
      await expect(pages.getByText('2 in this PDF')).toBeVisible();

      await pages.getByRole('button', { name: 'Move page 2 up' }).click();
      await expect.poll(thumbs, { timeout: 30_000, message: 'the fields should move with their page' }).toEqual(['Page 1 no fields', onPage1.replace('Page 1', 'Page 2')]);
      await reloadBuilder(preparePage);
      expect(await thumbs(), 'the new order persists').toEqual(['Page 1 no fields', onPage1.replace('Page 1', 'Page 2')]);
      expect(await preparePage.fieldCount(), 'no field is lost by re-ordering').toBe(fields);
      await pages.getByRole('button', { name: 'Move page 2 up' }).click();
      await expect.poll(thumbs, { timeout: 30_000 }).toEqual([onPage1, 'Page 2 no fields']);
    } finally {
      /* Delete every blank page this test added, so the draft is one page again. */
      for (let i = 0; i < 3; i++) {
        const current = await thumbs();
        const blank = current.findIndex((t) => /no fields$/.test(t));
        if (current.length <= 1 || blank < 0) break;
        await pages.getByRole('button', { name: `Delete page ${blank + 1}` }).click();
        await page.getByRole('dialog', { name: `Delete page ${blank + 1}?` }).getByRole('button', { name: 'Delete page' }).click();
        await expect.poll(async () => (await thumbs()).length, { timeout: 30_000 }).toBe(current.length - 1);
      }
    }
    await reloadBuilder(preparePage);
    expect(await thumbs()).toEqual(original);
    expect(await preparePage.fieldCount()).toBe(fields);
  });

  test('PREP-012 duplicate and align apply to the selection and Undo reverts them', async ({ preparePage, page }) => {
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const before = await preparePage.fieldCount();
    const positions = await fieldLabels(page);

    await selectType(preparePage, 'Full Name');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect.poll(() => preparePage.fieldCount(), { message: 'Duplicate adds one field' }).toBe(before + 1);
    await expect(fieldOf(page, 'Full Name')).toHaveCount(2);
    await undo.click();
    await expect.poll(() => preparePage.fieldCount(), { message: 'Undo removes the duplicate' }).toBe(before);

    /* Lasso every field, align them left: all share the left-most X. Undo restores each position. */
    const boxes = await page.getByRole('button', { name: / for Recipient \d+, / }).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    const [l, t, r, b] = [Math.min(...boxes.map((x) => x[0])) - 25, Math.min(...boxes.map((x) => x[1])) - 25, Math.max(...boxes.map((x) => x[2])) + 25, Math.max(...boxes.map((x) => x[3])) + 25];
    await page.mouse.move(l, t);
    await page.mouse.down();
    await page.mouse.move((l + r) / 2, (t + b) / 2, { steps: 5 });
    await page.mouse.move(r, b, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByText(new RegExp(`^${before} selected ·`))).toBeVisible();
    await page.getByRole('button', { name: 'Align left', exact: true }).click();
    const xs = () => fieldLabels(page).then((ls) => [...new Set(ls.map((s) => s.match(/at (\d+) by/)?.[1]))]);
    const minX = String(Math.min(...positions.map((s) => Number(s.match(/at (\d+) by/)![1]))));
    await expect.poll(xs, { message: 'Align left gives every field the left-most X' }).toEqual([minX]);
    await undo.click();
    await expect.poll(() => fieldLabels(page), { message: 'Undo restores every position' }).toEqual(positions);
    await page.keyboard.press('Escape');
    await settleAutosave(page);
  });

  test('PREP-013 Download PDF saves the current document; Save as template offers a name', async ({ preparePage, page }) => {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), preparePage.downloadPdfButton.click()]);
    expect(download.suggestedFilename()).toBe(`${BUILDER_DRAFT} (current).pdf`);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString(), 'the download is a PDF').toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1_000);

    /* Templates cannot be deleted (BUG-10), so the dialog is cancelled and nothing is saved. */
    const templatesBefore = (await (await page.request.get(API.templates)).json()).items.length;
    await preparePage.saveAsTemplateButton.click();
    await expect(preparePage.templateNameInput).toBeVisible();
    await expect(preparePage.templateNameInput).not.toHaveValue('');
    await preparePage.saveTemplateDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(preparePage.saveTemplateDialog).toBeHidden();
    expect((await (await page.request.get(API.templates)).json()).items.length, 'cancelling saves no template').toBe(templatesBefore);
  });

  test('PREP-016 canvas toolbar tools change the view and reflect the selection', async ({ page }) => {
    const zoom = page.getByText(/^\d+%$/).first();
    const percent = async () => Number((await zoom.innerText()).replace('%', ''));
    await expect(page.getByRole('button', { name: 'Undo', exact: true }), 'nothing to undo on a fresh load').toBeDisabled();
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Copy to every page' }), 'one page: nothing to copy to').toBeDisabled();

    const start = await percent();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(percent).toBeGreaterThan(start);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(percent).toBeLessThan(start);
    await page.getByRole('button', { name: 'Fit page', exact: true }).click();
    const fitPage = await percent();
    await page.getByRole('button', { name: 'Fit width', exact: true }).click();
    await expect.poll(percent, { message: 'Fit width and Fit page give different zooms' }).not.toBe(fitPage);

    const snap = page.getByRole('button', { name: 'Snap grid', exact: true });
    const pressed = await snap.getAttribute('aria-pressed');
    await snap.click();
    await expect(snap).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
    await snap.click();
    await expect(snap).toHaveAttribute('aria-pressed', pressed ?? 'false');

    for (const tool of ['Align left', 'Center', 'Distribute', 'Duplicate', 'Delete', 'Open preview', 'Find fields in the document']) {
      await expect(page.getByRole('button', { name: tool, exact: true })).toBeVisible();
    }
  });

  test('A11Y-010 a field tile is reached by keyboard with a visible focus ring and placed with Enter', async ({ preparePage, page }) => {
    const before = await preparePage.fieldCount();
    await preparePage.fieldSearch.focus();
    await preparePage.fieldSearch.fill('');
    /* Tab from the search box to the first palette tile. */
    let onTile = false;
    for (let i = 0; i < 6 && !onTile; i++) {
      await page.keyboard.press('Tab');
      onTile = await page.evaluate(() => /^Place .+ — drag onto the page/.test(document.activeElement?.getAttribute('aria-label') ?? ''));
    }
    expect(onTile, 'Tab from the palette search should reach a field tile').toBe(true);
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { outline: `${s.outlineStyle} ${s.outlineWidth}`, shadow: s.boxShadow, focusVisible: (document.activeElement as Element).matches(':focus-visible') };
    });
    expect(ring.focusVisible, 'keyboard focus should match :focus-visible').toBe(true);
    expect(!/^none/.test(ring.outline) && !/ 0px$/.test(ring.outline) || ring.shadow !== 'none', `focused tile has no visible ring (outline ${ring.outline}, shadow ${ring.shadow})`).toBe(true);

    await page.keyboard.press('Enter');
    await expect.poll(() => preparePage.fieldCount(), { message: 'Enter places the field' }).toBe(before + 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => preparePage.fieldCount()).toBe(before);
    await settleAutosave(page);
  });
});

test.describe('Workflow behaviour', () => {
  test.describe.configure({ mode: 'default' });

  let draftId = '';
  let builderFields = 0;
  test.beforeEach(async ({ preparePage }) => {
    await preparePage.goto();
    await preparePage.continueLatestDraft();
    draftId = preparePage.documentIdFromUrl();
    builderFields = await preparePage.fieldCount();
    await preparePage.goToWorkflow();
    await preparePage.settle();
  });

  test('WF-001 workflow step shows every section filled from this envelope', async ({ workflowPage, page }) => {
    const doc = await apiDocument(page, draftId);
    for (const heading of [workflowPage.invitePreview, workflowPage.beforeYouSend, workflowPage.expiration, workflowPage.branding, workflowPage.deliverySimulation]) {
      await expect(heading).toBeVisible();
    }
    await expect(page.getByRole('main')).toContainText(new RegExp(`${doc.title}\\s*\\d+ pages? · ${doc.recipients_total} recipients?`));
    await expect(workflowPage.recipientsRegion.getByRole('button', { name: /^Remove / })).toHaveCount(doc.recipients_total);
    await expect(workflowPage.subjectInput).toHaveAttribute('placeholder', `Signature requested: ${doc.title}`);
    await expect(workflowPage.invitePreviewGroup).toContainText(`Signature requested: ${doc.title}`);
    await expect(workflowPage.invitePreviewGroup.locator('dd').filter({ hasText: doc.title }).first()).toBeVisible();
    await expect(workflowPage.expiresSelect.locator('option:checked')).toHaveText(`After ${doc.expires_in_days} days`);
    const routing = page.getByRole('group', { name: 'Routing' });
    await expect(routing.getByRole('button', { name: doc.workflow_type === 'sequential' ? 'Sequential' : 'Parallel' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: 'Branding' }).getByRole('button', { name: 'Manage themes' })).toBeVisible();
  });

  test('WF-002 UF-25 routing mode switches, updates the summary and persists', async ({ workflowPage, page }) => {
    const original = (await apiDocument(page, draftId)).workflow_type;
    const target = original === 'sequential' ? 'parallel' : 'sequential';
    const label = (mode: string) => (mode === 'sequential' ? 'Sequential' : 'Parallel');
    const routing = page.getByRole('group', { name: 'Routing' });
    const sim = page.getByRole('region', { name: 'Delivery simulation' });
    try {
      await routing.getByRole('button', { name: label(target) }).click();
      await expect(routing.getByRole('button', { name: label(target) })).toHaveAttribute('aria-pressed', 'true');
      await expect(routing.getByRole('button', { name: label(original) })).toHaveAttribute('aria-pressed', 'false');
      await expect(sim, 'the delivery simulation follows the routing').toContainText(new RegExp(`now · ${target} ·`));
      await expect.poll(async () => (await apiDocument(page, draftId)).workflow_type, { timeout: 15_000, message: 'routing saved on the server' }).toBe(target);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(workflowPage.heading).toBeVisible();
      await expect(routing.getByRole('button', { name: label(target) }), 'the routing persists after reload').toHaveAttribute('aria-pressed', 'true');
    } finally {
      await routing.getByRole('button', { name: label(original) }).click();
      await expect.poll(async () => (await apiDocument(page, draftId)).workflow_type, { timeout: 15_000 }).toBe(original);
    }
  });

  test('WF-006 UF-25 expiry choice updates the simulation and persists; no reminder cadence is offered', async ({ workflowPage, page }) => {
    const original = (await apiDocument(page, draftId)).expires_in_days;
    const target = original === 30 ? 7 : 30;
    await expect(page.getByRole('group', { name: 'Reminder cadence' })).toHaveCount(0);
    const sim = page.getByRole('region', { name: 'Delivery simulation' });
    try {
      await workflowPage.expiresSelect.selectOption({ label: `After ${target} days` });
      await expect(sim).toContainText(new RegExp(`Expires\\s*in ${target} days · auto-void`));
      await expect.poll(async () => (await apiDocument(page, draftId)).expires_in_days, { timeout: 15_000, message: 'expiry saved on the server' }).toBe(target);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(workflowPage.heading).toBeVisible();
      await expect(workflowPage.expiresSelect.locator('option:checked'), 'the expiry persists after reload').toHaveText(`After ${target} days`);
    } finally {
      await workflowPage.expiresSelect.selectOption({ label: `After ${original} days` });
      await expect.poll(async () => (await apiDocument(page, draftId)).expires_in_days, { timeout: 15_000 }).toBe(original);
    }
  });

  test('WF-005 before-you-send flags every recipient without an e-mail and counts the assigned fields', async ({ workflowPage, page }) => {
    const checklist = workflowPage.beforeYouSendRegion.getByRole('listitem');
    const emails = workflowPage.recipientsRegion.getByRole('combobox', { name: /^.+ email$/ });
    const missing: string[] = [];
    for (const box of await emails.all()) {
      if (!(await box.inputValue())) missing.push(((await box.getAttribute('aria-label')) ?? '').replace(/ email$/, ''));
    }
    for (const name of missing) {
      await expect(checklist.filter({ hasText: `${name} — add an email above. Sending is blocked` }), `${name} has no e-mail and must be flagged as blocking`).toHaveCount(1);
    }
    if (missing.length === 0) await expect(checklist.filter({ hasText: 'Recipient email is required' })).toHaveCount(0);

    /* "N fields assigned" equals the builder's field count. */
    await expect(checklist.filter({ hasText: new RegExp(`^\\s*${builderFields} fields? assigned`) })).toHaveCount(1);
    for (const fixed of ['Disclosure attached', 'Certificate enabled']) await expect(checklist.filter({ hasText: fixed })).toHaveCount(1);
  });

  test('WF-009 sending is blocked while a recipient has no e-mail, and nothing is sent', async ({ workflowPage, page, context }) => {
    /* Safety net: any state-changing request about sending is aborted in the browser. */
    const attempts: string[] = [];
    await context.route(/\/api\/proxy\/.*(send|dispatch|deliver)/i, (route) => {
      if (route.request().method() === 'GET') return route.continue();
      attempts.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    });
    const missing = await apiRecipients(page, draftId).then((rs) => rs.filter((r) => !r.email));
    expect(missing.length, 'the builder draft keeps a recipient without an e-mail, which must block sending').toBeGreaterThan(0);
    await expect(workflowPage.beforeYouSendRegion.getByRole('listitem').filter({ hasText: 'Sending is blocked' }).first()).toBeVisible();

    await workflowPage.sendEnvelopeButton.click();
    await page.waitForTimeout(2_000);
    expect(attempts, 'the app tried to send a blocked envelope (the request was aborted by the test)').toEqual([]);
    await expect(page).toHaveURL(/\/workflow/);
    const doc = (await (await page.request.get(API.document(draftId))).json()) as { status: string; sent_at: string | null };
    expect(doc.sent_at, 'the envelope must not be sent').toBeNull();
    expect(['draft', 'prepared']).toContain(doc.status);
  });

  test('WF-008 delivery simulation lists the queue, each signer and the expiry from the settings', async ({ workflowPage, page }) => {
    const doc = await apiDocument(page, draftId);
    const steps = page.getByRole('region', { name: 'Delivery simulation' }).getByRole('listitem');
    const plural = doc.recipients_total === 1 ? '' : 's';
    await expect(steps.first()).toHaveText(new RegExp(`^Envelope queued\\s*now · ${doc.workflow_type} · ${doc.recipients_total} recipient${plural}$`));
    await expect(steps.last()).toHaveText(new RegExp(`^Expires\\s*in ${doc.expires_in_days} days · auto-void$`));
    const notified = steps.filter({ hasText: /^Signer \d+ notified/ });
    expect(await notified.count(), 'at least one signer is notified').toBeGreaterThan(0);
    for (const line of await notified.allTextContents()) expect(line.replace(/\s+/g, ' ')).toMatch(/^Signer \d+ notified ?\+\d+[smhd]? · (no email yet|\S+@\S+)$/);
    await expect(workflowPage.expiresSelect.locator('option:checked')).toHaveText(`After ${doc.expires_in_days} days`);
  });
});
