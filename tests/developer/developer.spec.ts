import { test, expect } from '../../src/fixtures/test';

test.describe('Developer platform', () => {
  test.beforeEach(async ({ developerPage }) => {
    await developerPage.goto();
  });

  test('shows API health metrics and add-on summary @smoke', async ({ developerPage }) => {
    await expect(developerPage.heading).toBeVisible();
    await expect(developerPage.page.getByText('Active keys')).toBeVisible();
    await expect(developerPage.page.getByText('Error rate')).toBeVisible();
    await expect(developerPage.page.getByText('Embed sessions · 24h')).toBeVisible();
  });

  test('navigates between developer sections', async ({ developerPage }) => {
    await developerPage.openSection('API keys');
    await expect(developerPage.page).toHaveURL(/section=keys/);
    await developerPage.expectKeyEmptyState();

    await developerPage.openSection('Webhooks');
    await expect(developerPage.page).toHaveURL(/section=webhooks/);
  });

  test('opens the API console', async ({ developerPage }) => {
    await developerPage.apiConsoleLink.click();
    await expect(developerPage.page).toHaveURL(/\/developer\/sandbox/);
    await expect(developerPage.page.getByRole('heading', { name: 'API console' })).toBeVisible();
    await expect(developerPage.page.getByRole('button', { name: 'Send request' })).toBeVisible();
  });

  test('opens the guides library', async ({ developerPage }) => {
    await developerPage.guidesLink.click();
    await expect(developerPage.page).toHaveURL(/\/developer\/guides/);
    await expect(
      developerPage.page.getByRole('heading', { name: 'Guides & documentation' }),
    ).toBeVisible();
  });

  test('lists API scopes on the keys page', async ({ developerPage }) => {
    await developerPage.openSection('API keys');
    for (const scope of [
      'users:read',
      'contacts:read',
      'contacts:write',
      'documents:read',
      'documents:write',
      'envelopes:send',
      'audit:read',
      'partner:manage',
    ]) {
      await expect(developerPage.page.getByText(scope, { exact: true })).toBeVisible();
    }
  });
});
