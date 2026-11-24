import { expect, type Locator, type Page } from '@playwright/test';
import { clickUntilVisible } from '../helpers/wait';

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
    /* On narrow screens the drawer opens from a button; retry if the first click lands before hydration (R3). */
    if (!(await this.nav.isVisible().catch(() => false))) {
      await clickUntilVisible(this.openButton, this.nav, { what: "The navigation drawer did not open" });
    }
    await expect(this.nav).toBeVisible();
  }

  sectionLink(name: 'Home' | 'Documents' | 'Contacts' | 'Reports' | 'Support' | 'My account'): Locator {
    return this.nav.getByRole('link', { name, exact: true });
  }

  async goTo(section: 'Home' | 'Documents' | 'Contacts' | 'Reports' | 'Support' | 'My account') {
    await this.open();
    await this.sectionLink(section).click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitUntilClosed();
  }

  /**
   * On narrow screens the drawer closes after a link in it navigates. Wait for that, or the
   * next open() sees the closing drawer as "already open" and its links vanish under the click.
   * No-op on desktop, where the sidebar is always shown.
   */
  async waitUntilClosed(): Promise<void> {
    if (await this.openButton.isVisible().catch(() => false)) await expect(this.nav).toBeHidden();
  }

  async signOutFromMenu(): Promise<void> {
    await this.page.getByRole('button', { name: /Account and help/ }).click();
    /* Account menu entries are role="menuitem", not buttons. */
    await this.page.getByRole('menu', { name: 'Account and help' }).getByRole('menuitem', { name: 'Sign out' }).click();
  }
}
