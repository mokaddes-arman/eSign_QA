import { test, expect } from '../../src/fixtures/test';
import { clickUntilVisible, waitForHydration } from '../../src/helpers/wait';
import { HYDRATION_ERROR } from '../../src/helpers/ui';
import { API } from '../../src/helpers/api';
import { KNOWN_BUGS, expectBugsToFail, knownBug } from '../../src/helpers/bugs';

test.describe('Authenticated navigation', () => {
  test('NAV-001 exposes every module in the main navigation and each link opens it @smoke', async ({
    page,
    overviewPage,
    navigation,
  }) => {
    await overviewPage.goto();
    await navigation.open();

    /* Every entry is visible and lands on its own page (URL + page heading), not just rendered. */
    const destinations = [
      { section: 'Documents', url: /\/documents$/, h1: 'Documents' },
      { section: 'Contacts', url: /\/contacts$/, h1: 'Contacts' },
      { section: 'Reports', url: /\/reports$/, h1: 'Reports' },
      { section: 'Support', url: /\/support$/, h1: 'Support' },
      { section: 'My account', url: /\/account\/profile$/, h1: 'User profile' },
      { section: 'Home', url: /\/overview$/, h1: 'Overview' },
    ] as const;
    for (const { section } of destinations) await expect(navigation.sectionLink(section)).toBeVisible();
    for (const { section, url, h1 } of destinations) {
      await navigation.goTo(section);
      await expect(page, `"${section}" did not open its page`).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: h1, exact: true })).toBeVisible();
    }

    await navigation.open();
    await expect(navigation.planUsageLink).toBeVisible();
    await navigation.planUsageLink.click();
    await expect(page).toHaveURL(/\/account\/billing$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Billing & plan' })).toBeVisible();
    await navigation.waitUntilClosed();
    await navigation.open();
    await navigation.createLink.click();
    await expect(page).toHaveURL(/\/documents\/prepare$/);
  });

  test('navigates to Contacts from the sidebar', async ({ page, overviewPage, navigation }) => {
    await overviewPage.goto();
    await navigation.goTo('Contacts');
    await expect(page).toHaveURL(/\/contacts/);
  });

  test('NAV-003 account and help menu shows who is signed in and every item works', async ({ page, overviewPage }) => {
    const me = await (await page.request.get(API.me)).json();
    const menuButton = page.getByRole('button', { name: /Account and help/ });
    const menu = page.getByRole('menu', { name: 'Account and help' });
    const openMenu = async () => {
      await overviewPage.goto();
      await clickUntilVisible(menuButton, menu, { what: 'The account menu did not open' });
    };

    await openMenu();
    await expect(menu.getByText(me.name, { exact: true })).toBeVisible();
    await expect(menu).toContainText(me.email);
    await expect(menu).toContainText(`${me.organization_name} · ${me.role}`);
    await expect(menu.getByRole('menuitem')).toHaveText(['My account', 'Notifications', 'Start product tour', 'Support centre', 'Contact support', 'Sign out']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    /* Sign out ends the account's single session; it is exercised in tests/security/session.spec.ts. */
    const pages = [
      { item: 'My account', url: /\/account\/profile$/, h1: 'User profile' },
      { item: 'Notifications', url: /\/notifications$/, h1: 'Notifications' },
      { item: 'Support centre', url: /\/support$/, h1: 'Support' },
    ];
    for (const { item, url, h1 } of pages) {
      await openMenu();
      await menu.getByRole('menuitem', { name: item }).click();
      await expect(page, `"${item}" did not open its page`).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: h1, exact: true })).toBeVisible();
    }

    await openMenu();
    await menu.getByRole('menuitem', { name: 'Contact support' }).click();
    const ticket = page.getByRole('dialog', { name: 'New support ticket' });
    await expect(ticket.getByRole('textbox', { name: 'Subject' })).toBeVisible();
    await ticket.getByRole('button', { name: 'Cancel' }).click();
    await expect(ticket).toBeHidden();

    await openMenu();
    await menu.getByRole('menuitem', { name: 'Start product tour' }).click();
    const tour = page.getByRole('dialog', { name: 'Product tour' });
    await expect(tour.getByText(/Step 1 of \d+/)).toBeVisible();
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour).toBeHidden();
  });

  test('BUG-36 product tour names only the sidebar areas that exist', knownBug(KNOWN_BUGS.BUG36), async ({ page, overviewPage, navigation }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await overviewPage.goto();
    await navigation.open();
    const sections = (await navigation.nav.getByRole('navigation', { name: 'Sections' }).getByRole('link').allInnerTexts()).map((t) => t.trim());
    const tour = page.getByRole('dialog', { name: 'Product tour' });
    await clickUntilVisible(page.getByRole('button', { name: 'Take the tour' }), tour.getByText(/Step 1 of \d+/));
    const intro = await tour.innerText();
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    /* "The top level is your product areas — Home, Documents, … and My account — and each owns …" */
    const named = intro.match(/product areas\s*[—-]\s*([^—]+?)\s*[—-]/)?.[1];
    expect(named, `step 1 should list the product areas: "${intro}"`).toBeTruthy();
    const areas = named!.split(/,\s*|\s+and\s+/).map((a) => a.trim()).filter(Boolean);
    expect(areas.filter((a) => !sections.includes(a)), `tour areas not in the sidebar (${sections.join(', ')})`).toEqual([]);
  });

  test('unknown routes return the 404 page', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "That page isn't here" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open documents' })).toBeVisible();
  });

  test('global search returns grouped results', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await dialog.getByRole('combobox', { name: 'Search' }).fill('sample');

    const results = dialog.getByRole('listbox', { name: 'Search results' });
    await expect(results.getByRole('group', { name: 'Documents' })).toBeVisible();
    await expect(results.getByRole('option', { name: /See all documents matching/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('notifications bell opens a popover linking to the centre', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    const popover = page.getByRole('dialog', { name: 'Notifications' });
    await clickUntilVisible(page.getByRole('button', { name: 'Notifications' }).first(), popover);
    await popover.getByRole('link', { name: 'See all notifications' }).click();
    await expect(page).toHaveURL(/\/notifications/);
  });

  test('product tour starts and can be skipped', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    const tour = page.getByRole('dialog', { name: 'Product tour' });
    await clickUntilVisible(page.getByRole('button', { name: 'Take the tour' }), tour.getByText(/Step 1 of \d+/));
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour).toBeHidden();
  });

  test('global search opens with keyboard shortcut', async ({ page, overviewPage }) => {
    await overviewPage.goto();
    await page.keyboard.press('Control+k');

    const dialog = page.getByRole('dialog', { name: 'Search your workspace' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeVisible();
  });

  test('NF-010 a dropped connection does not end the session', async ({ contactsPage, page, context }) => {
    await contactsPage.goto();
    await context.setOffline(true);
    /* Each engine reports the offline reload differently (Chromium ERR_INTERNET_DISCONNECTED,
       WebKit "internal error", Firefox may leave it pending) — only the recovery is asserted. */
    await page.reload({ timeout: 10_000 }).catch(() => undefined);
    await context.setOffline(false);
    /* Firefox resumes the pending reload once online, which can interrupt the next goto: retry. */
    await expect(async () => {
      await contactsPage.goto();
    }).toPass({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/contacts/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    test.info().annotations.push({ type: 'observation', description: 'Offline navigation shows the browser error page; the app has no offline notice of its own.' });
  });
});

test.describe('Platform resilience', () => {
  /* Intermittent by nature: no test.fail() under KNOWN_BUGS=expect-fail, so a clean pass simply
     means "not reproduced this run". It fails only when a hydration error is actually seen. */
  test('BUG-16 REG-B16 main pages hydrate without React errors', knownBug(KNOWN_BUGS.BUG16), async ({ page }) => {
    const seen: string[] = [];
    page.on('pageerror', (e) => { if (HYDRATION_ERROR.test(e.message)) seen.push(`${page.url()}: ${e.message.slice(0, 160)}`); });
    /* Trash was one of the two pages it was reported on; Activity logs were removed on 20 Nov 2026. */
    for (const path of ['/overview', '/documents', '/documents?folder=trash', '/contacts', '/reports', '/support', '/notifications', '/account/audit']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(seen, 'React hydration errors').toEqual([]);
  });

  test('BUG-44 NF-010 navigating while offline keeps the app with a notice and recovers', knownBug(KNOWN_BUGS.BUG44), async ({ page, context, contactsPage }) => {
    test.fail(expectBugsToFail, 'KNOWN_BUGS=expect-fail');
    await contactsPage.goto();
    try {
      await context.setOffline(true);
      await page.getByRole('complementary', { name: 'Main navigation' }).getByRole('link', { name: 'Reports', exact: true }).click();
      await page.waitForTimeout(3_000);
      /* Chromium shows chrome-error://, Firefox about:neterror — either way the app is gone. */
      expect(page.url(), 'the app must not be replaced by the browser error page').toMatch(/^https:\/\/esignpro\.net\//);
      await expect(page.getByText(/offline|no connection|connection (was )?lost|network/i).first(), 'an in-app offline notice').toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    await expect(page, 'the page should recover once the connection is back').toHaveURL(/esignpro\.net\/(reports|contacts)/, { timeout: 20_000 });
  });
});
