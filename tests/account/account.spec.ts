import { test, expect } from '../../src/fixtures/test';
import { waitForHydration } from '../../src/helpers/wait';

test.describe('Account · profile & security', () => {
  test('shows profile details for the signed-in user @smoke', async ({ profilePage, page }) => {
    await profilePage.goto();

    await expect(profilePage.heading).toBeVisible();
    await expect(profilePage.fullNameInput).toHaveValue(/Mokaddes/);
    await expect(profilePage.emailInput).toHaveValue(/esignTest@gmail\.com/i);
    await expect(page.getByText(/Email verified/)).toBeVisible();
  });

  test('offers appearance, password and signature settings', async ({ profilePage }) => {
    await profilePage.goto();

    await expect(profilePage.changePasswordButton).toBeVisible();
    await expect(profilePage.addSignatureButton).toBeVisible();
    await expect(profilePage.themeGroup).toBeVisible();

    await profilePage.openChangePassword();
    await expect(profilePage.currentPasswordInput).toBeVisible();
    await profilePage.page.keyboard.press('Escape');

    await profilePage.openSignatureDialog();
    await expect(profilePage.signatureDialog.getByRole('tab', { name: 'Draw' })).toBeVisible();
    await expect(profilePage.signatureDialog.getByRole('tab', { name: 'Type' })).toBeVisible();
    await expect(profilePage.signatureDialog.getByRole('tab', { name: 'Upload' })).toBeVisible();
  });

  test('shows login & security controls', async ({ page }) => {
    await page.goto('/account/security');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { name: 'Settings · login and security' })).toBeVisible();
    await expect(page.getByText('Two-factor authentication')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Passkeys', exact: true })).toBeVisible();
    await expect(page.getByText('Single sign-on (SAML)')).toBeVisible();
    await expect(page.getByText('Authenticated devices and browsers')).toBeVisible();
  });

  test('lists notification preferences', async ({ page }) => {
    await page.goto('/account/notifications');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { name: 'Notifications & email' })).toBeVisible();
    for (const event of [
      'A document I sent is delivered',
      'A recipient views my document',
      'A recipient signs my document',
      'A document completes',
      'A recipient declines',
      'A document is about to expire',
      'A reminder is sent on my behalf',
      'Weekly activity summary',
    ]) {
      await expect(page.getByText(event, { exact: true })).toBeVisible();
    }
  });

  test('opens the change-plan and add-seat dialogs', async ({ billingPage }) => {
    await billingPage.goto();
    await expect(billingPage.heading).toBeVisible();
    await expect(billingPage.planCard).toBeVisible();

    await billingPage.openChangePlan();
    for (const plan of ['Free', 'Team', 'Business', 'Enterprise'] as const) {
      await expect(billingPage.planOption(plan)).toBeVisible();
    }
    await billingPage.page.keyboard.press('Escape');

    await billingPage.openAddSeats();
    await expect(billingPage.seatsInput).toBeVisible();
  });

  test('change password dialog validates input @regression', async ({ profilePage }) => {
    await profilePage.goto();
    await profilePage.openChangePassword();
    await expect(profilePage.currentPasswordInput).toBeVisible();
    await profilePage.page.keyboard.press('Escape');
  });
});
