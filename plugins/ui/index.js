import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { attachPageListeners, collectEvidence } from '../../helpers/evidence.js';
import { startNetworkMonitor } from '../../helpers/network.js';
import { runUiHealthChecks } from '../../helpers/uiHealth.js';
import { resolveTemplate } from '../../helpers/template.js';

const uiPlugin = {
  id: 'ui',
  priority: 20,
  isEnabled: (config) => config.pages.length > 0 || config.buttonChecks.length > 0 || config.plugins?.ui !== false,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    test.beforeEach(async ({ page }) => {
      attachPageListeners(page, context);
      startNetworkMonitor(page, context, config.network || {});
    });

    test.afterEach(async ({ page }, testInfo) => {
      if (testInfo.status !== testInfo.expectedStatus) {
        await collectEvidence(page, testInfo, context);
      }
    });

    for (const pageConfig of config.pages) {
      test(`Page loads - ${pageConfig.name} (${pageConfig.path})`, { tag: pageConfig.tags }, async ({ page }) => {
        if (pageConfig.requiresAuth) await loginViaUI(page, config);

        const response = await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, {
          waitUntil: 'domcontentloaded',
        });

        if (response) {
          expect(response.status(), `${pageConfig.name} returned HTTP ${response.status()}`).toBeLessThan(400);
        }

        const selector = pageConfig.expectSelector || 'body';
        const locator = page.locator(selector).first();
        const isVisible = await locator.isVisible().catch(() => false);

        if (pageConfig.knownIssue && !isVisible) {
          test.fixme(true, pageConfig.knownIssue);
          return;
        }

        await expect(locator, `${pageConfig.name}: expected "${selector}" not visible`).toBeVisible({ timeout: 8000 });

        if (pageConfig.healthCheck !== false) {
          const issues = await runUiHealthChecks(page, config.uiHealth || {}, context);
          const critical = issues.filter((i) => ['blank-page', 'js-errors'].includes(i.type));
          if (critical.length > 0 && !pageConfig.knownIssue) {
            throw new Error(`UI health issues on ${pageConfig.name}: ${JSON.stringify(critical)}`);
          }
        }
      });
    }

    for (const check of config.buttonChecks) {
      test(`Button check - "${check.buttonText}" on ${check.pageName}`, { tag: check.tags }, async ({ page }) => {
        const pageConfig = config.pages.find((p) => p.name === check.pageName);
        if (!pageConfig) throw new Error(`buttonChecks references unknown pageName "${check.pageName}"`);

        if (pageConfig.requiresAuth) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${pageConfig.path}`, { waitUntil: 'domcontentloaded' });

        const button = page.getByRole('button', { name: check.buttonText }).first();
        await expect(button).toBeVisible();

        if (check.expectAction === 'opens-modal-or-navigates') {
          const urlBefore = page.url();
          await button.click();
          const modalAppeared = await page.locator('[role="dialog"], .ant-modal').first().isVisible({ timeout: 3000 }).catch(() => false);
          const navigated = page.url() !== urlBefore;
          expect(modalAppeared || navigated).toBeTruthy();
        }
      });
    }
  },
};

export default uiPlugin;
