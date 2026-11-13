import { test, expect } from '../../src/fixtures/test';
import { waitForHydration } from '../../src/helpers/wait';

/* Read-only: never press "Create key" (it creates a key immediately) or "Send request". */
test.describe('Developer tools', () => {
  test('endpoints reference shows grouped routes', async ({ developerPage }) => {
    await developerPage.goto();
    await developerPage.openSection('Endpoints');
    const groups = developerPage.page.getByRole('group', { name: 'Endpoint group' });
    for (const group of ['Workspace', 'Documents', 'Embedding']) {
      await expect(groups.getByRole('button', { name: group })).toBeVisible();
    }
    await expect(developerPage.page.getByRole('region', { name: 'Endpoints' })).toContainText(
      /GET\s*\/api\/v1\/whoami/,
    );
    await expect(developerPage.page.getByRole('heading', { name: /Example response/ })).toBeVisible();
  });

  test('plan usage lists metered allowances', async ({ developerPage }) => {
    await developerPage.goto();
    await developerPage.openSection('Plan usage');
    const usage = developerPage.page.getByRole('region', { name: /Plan usage · current cycle/ });
    for (const meter of ['Signature requests', 'API calls', 'Storage', 'SMS sent']) {
      await expect(usage).toContainText(meter);
    }
  });

  test('webhook endpoint dialog requires a URL', async ({ developerPage }) => {
    await developerPage.goto();
    await developerPage.openSection('Webhooks');
    await developerPage.page.getByRole('button', { name: 'Add endpoint' }).first().click();
    const dialog = developerPage.page.getByRole('dialog', { name: 'Add endpoint' });
    await expect(dialog.getByRole('button', { name: 'Create endpoint' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('API console offers methods, endpoints and code snippets', async ({ page }) => {
    await page.goto('/developer/sandbox');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: 'API console' })).toBeVisible();
    const methods = await page.getByLabel('Method').locator('option').allTextContents();
    expect(methods).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
    await expect(page.getByLabel('Endpoint')).toBeVisible();

    const languages = page.getByRole('group', { name: 'Snippet language' });
    await languages.getByRole('button', { name: 'Python' }).click();
    await expect(languages.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Recent calls' })).toBeVisible();
  });

  test('activity logs filter by source and level', async ({ page }) => {
    await page.goto('/developer/logs');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Activity logs' })).toBeVisible();
    const sources = page.getByRole('group', { name: 'Filter by source' });
    for (const source of ['All', 'API', 'Webhooks', 'Auth', 'Billing', 'Signing', 'Admin']) {
      await expect(sources.getByRole('button', { name: source, exact: true })).toBeVisible();
    }
    await sources.getByRole('button', { name: 'Billing', exact: true }).click();
    await expect(sources.getByRole('button', { name: 'Billing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('searchbox', { name: 'Search logs' })).toBeVisible();
  });

  test('partner program shows the application form', async ({ page }) => {
    await page.goto('/developer/partner');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Partner program' })).toBeVisible();
    for (const field of ['Company website', 'How will you use eSignPro?', 'Expected customers', 'Contact name', 'Contact email']) {
      await expect(page.getByRole('textbox', { name: field })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Send application' })).toBeVisible();
  });
});
