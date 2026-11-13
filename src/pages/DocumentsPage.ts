import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type DocumentView =
  | 'All documents'
  | 'Templates'
  | 'Archive'
  | 'Trash'
  | 'Waiting for me'
  | 'Waiting for others'
  | 'Drafts'
  | 'Completed'
  | 'Expiring soon'
  | 'Favourites'
  | 'Shared with me'
  | 'Owned by me';

export class DocumentsPage extends BasePage {
  protected readonly path = '/documents';

  readonly heading = this.page.getByRole('heading', { level: 1, name: 'Documents' });
  readonly searchInput = this.page.getByRole('searchbox', { name: /search documents/i });
  readonly sortSelect = this.page.getByLabel('Sort');
  readonly filtersButton = this.page.getByRole('button', { name: 'Filters' });
  readonly newFolderButton = this.page.getByRole('button', { name: 'New folder' });
  readonly uploadPrepareButton = this.page.getByRole('button', { name: 'Upload & prepare' });
  readonly uploadFileButton = this.page.getByRole('button', { name: 'Upload a file' });
  readonly fileInput = this.page.locator('input[type=file]').first();

  readonly statusFilter = this.page.getByLabel('Filter by status');
  readonly typeFilter = this.page.getByLabel('Filter by type');
  readonly timeFilter = this.page.getByLabel('Filter by time');
  readonly ownerFilter = this.page.getByLabel('Filter by owner');

  readonly rows = this.page.locator('tbody tr');
  readonly emptyTitle = this.page.getByText(/Nothing in Documents|No .* yet/);

  folderLink(name: DocumentView) {
    return this.page.getByRole('link', { name: new RegExp(`^${name}`) });
  }

  async waitForReady(): Promise<void> {
    await super.waitForReady();
    await expect(this.heading).toBeVisible();
  }

  async openFolder(name: DocumentView): Promise<void> {
    await this.folderLink(name).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openFilters(): Promise<void> {
    await this.filtersButton.click();
    await expect(this.statusFilter).toBeVisible();
  }

  /**
   * Sorting is applied through a server round-trip: the select reverts to its
   * previous value until `?sort=` is committed, so wait for the URL rather
   * than asserting the value straight after `selectOption()`.
   */
  async selectSort(label: 'Recent' | 'Name' | 'Status' | 'Owner'): Promise<void> {
    const value = label.toLowerCase();
    const committed = new RegExp(`[?&]sort=${value}(?:&|$)`);

    await this.sortSelect.selectOption({ label });
    try {
      await expect(this.page).toHaveURL(committed, { timeout: 15_000 });
    } catch {
      /* The change can land before the client listener is attached; retry once. */
      await this.sortSelect.selectOption({ label });
      await expect(this.page).toHaveURL(committed, { timeout: 15_000 });
    }
    await expect(this.sortSelect).toHaveValue(value, { timeout: 10_000 });
  }

  async createFolder(name: string): Promise<void> {
    await this.newFolderButton.click();
    await this.page.getByRole('textbox', { name: 'Folder name' }).fill(name);
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  async uploadDocument(filePath: string): Promise<void> {
    /* "Upload & prepare" opens the native file chooser and, once a file is
       chosen, creates the draft and routes straight to the builder. */
    const [chooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.uploadPrepareButton.click(),
    ]);
    await chooser.setFiles(filePath);
    await expect(this.page).toHaveURL(/\/documents\/[0-9a-f-]+\/(prepare|workflow)/, {
      timeout: 30_000,
    });
  }

  rowByName(name: string | RegExp) {
    return this.rows.filter({ hasText: name });
  }
}
