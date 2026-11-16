import { expect, type Locator, type Page } from '@playwright/test';

/** Slide-out main navigation available on every authenticated page. */
export class Navigation {
  constructor(private readonly page: Page) {}

  get openButton(): Locator {
    return this.page.getByRole('button', { name: 'Open navigation' });
  }

  get closeButton(): Locator {
    return this.page.getByRole('button', { name: 'Close navigation' });
  }

  get nav(): Locator {
    return this.page.getByRole('complementary', { name: 'Main navigation' });
  }

  get createLink(): Locator {
    return this.nav.getByRole('link', { name: 'Create', exact: true });
  }

  get planUsageLink(): Locator {
    return this.page.getByRole('link', { name: /% of this month’s envelopes used/ });
  }

  async open(): Promise<void> {
    if (!(await this.nav.isVisible().catch(() => false))) {
      await this.openButton.click();
    }
    await expect(this.nav).toBeVisible();
  }

  sectionLink(name: 'Home' | 'Documents' | 'Contacts' | 'Reports' | 'Developer' | 'Support' | 'My account'): Locator {
    return this.nav.getByRole('link', { name, exact: true });
  }

  async goTo(section: 'Home' | 'Documents' | 'Contacts' | 'Reports' | 'Developer' | 'Support' | 'My account') {
    await this.open();
    await this.sectionLink(section).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async signOutFromMenu(): Promise<void> {
    await this.page.getByRole('button', { name: /Account and help/ }).click();
    /* Account menu entries are role="menuitem", not buttons. */
    await this.page.getByRole('menu', { name: 'Account and help' }).getByRole('menuitem', { name: 'Sign out' }).click();
  }
}
