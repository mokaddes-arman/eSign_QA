import { expect, test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { OverviewPage } from '../pages/OverviewPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { PreparePage } from '../pages/PreparePage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { ContactsPage } from '../pages/ContactsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { DeveloperPage } from '../pages/DeveloperPage';
import { SupportPage } from '../pages/SupportPage';
import { AccountProfilePage } from '../pages/AccountProfilePage';
import { BillingPage } from '../pages/BillingPage';
import { SignerPreviewPage } from '../pages/SignerPreviewPage';
import { Navigation } from '../components/Navigation';
import { createLogger } from '../helpers/logger';
import { explainFailure, reportHealing } from '../helpers/selfHeal';

type UiFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  verifyEmailPage: VerifyEmailPage;
  overviewPage: OverviewPage;
  documentsPage: DocumentsPage;
  preparePage: PreparePage;
  workflowPage: WorkflowPage;
  contactsPage: ContactsPage;
  reportsPage: ReportsPage;
  developerPage: DeveloperPage;
  supportPage: SupportPage;
  profilePage: AccountProfilePage;
  billingPage: BillingPage;
  signerPreviewPage: SignerPreviewPage;
  navigation: Navigation;
  logStep: (message: string) => Promise<void>;
  /** Auto fixture: self-healing report + plain-language failure summary. */
  qaDiagnostics: void;
};

export const test = base.extend<UiFixtures>({
  homePage: async ({ page }, use) => use(new HomePage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  verifyEmailPage: async ({ page }, use) => use(new VerifyEmailPage(page)),
  overviewPage: async ({ page }, use) => use(new OverviewPage(page)),
  documentsPage: async ({ page }, use) => use(new DocumentsPage(page)),
  preparePage: async ({ page }, use) => use(new PreparePage(page)),
  workflowPage: async ({ page }, use) => use(new WorkflowPage(page)),
  contactsPage: async ({ page }, use) => use(new ContactsPage(page)),
  reportsPage: async ({ page }, use) => use(new ReportsPage(page)),
  developerPage: async ({ page }, use) => use(new DeveloperPage(page)),
  supportPage: async ({ page }, use) => use(new SupportPage(page)),
  profilePage: async ({ page }, use) => use(new AccountProfilePage(page)),
  billingPage: async ({ page }, use) => use(new BillingPage(page)),
  signerPreviewPage: async ({ page }, use) => use(new SignerPreviewPage(page)),
  navigation: async ({ page }, use) => use(new Navigation(page)),
  logStep: async ({}, use, testInfo) => {
    const log = createLogger(testInfo.title);
    await use(async (message: string) => {
      log.info(message);
      await testInfo.attach('step', { body: message, contentType: 'text/plain' });
    });
  },
  qaDiagnostics: [
    async ({ page }, use, testInfo) => {
      await use();
      await reportHealing(page, testInfo);
      const failed = testInfo.status !== testInfo.expectedStatus && testInfo.status !== 'skipped';
      if (failed && testInfo.error?.message) {
        const summary = await explainFailure(page, testInfo.error.message);
        testInfo.annotations.push({ type: 'failure-summary', description: summary });
        await testInfo.attach('failure-summary', { body: summary, contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
});

export { expect };
