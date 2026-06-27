import { test, expect } from '@playwright/test';
import { loadConfig } from '../core/config.js';

const config = loadConfig();
const frontendUrl = config.frontendUrl || config.baseUrl;

async function loginViaUI(page, config) {
  if (!config.uiLogin) return; // project may handle auth differently or not need UI login
  await page.goto(`${frontendUrl}${config.uiLogin.path}`);
  await page.fill(config.uiLogin.usernameSelector, config.uiLogin.username);
  await page.fill(config.uiLogin.passwordSelector, config.uiLogin.password);
  await page.click(config.uiLogin.submitSelector);
  await page.waitForURL(config.uiLogin.successUrlPattern || '**/*', { timeout: 10000 });
}

test.describe(`UI page tests - ${config.projectName}`, () => {
  test.beforeEach(async ({ page }) => {
    // Surface JS console errors as test annotations rather than silently passing
    page.on('pageerror', (err) => {
      test.info().annotations.push({ type: 'console-error', description: err.message });
    });
  });

  for (const pageConfig of config.pages) {
    test(`Page loads - ${pageConfig.name} (${pageConfig.path})`, async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      if (pageConfig.requiresAuth) {
        await loginViaUI(page, config);
      }

      const response = await page.goto(`${frontendUrl}${pageConfig.path}`, { waitUntil: 'domcontentloaded' });

      // Page should not 404/500 at the HTTP level (catches SSR/server-rendered fallthroughs)
      if (response) {
        expect(
          response.status(),
          `${pageConfig.name} returned HTTP ${response.status()}`
        ).toBeLessThan(400);
      }

      // Page should render the expected anchor element (catches client-side router fallthroughs/blank screens)
      const selector = pageConfig.expectSelector || 'body';
      const locator = page.locator(selector).first();

      const isVisible = await locator.isVisible().catch(() => false);

      if (pageConfig.knownIssue && !isVisible) {
        console.warn(`[KNOWN ISSUE] ${pageConfig.name}: expected selector "${selector}" not visible. Reason: ${pageConfig.knownIssue}`);
        test.fixme(true, pageConfig.knownIssue);
        return;
      }

      await expect(
        locator,
        `${pageConfig.name}: expected selector "${selector}" not found/visible - page may have rendered blank or fallen through`
      ).toBeVisible({ timeout: 8000 });

      if (consoleErrors.length > 0 && !pageConfig.knownIssue) {
        console.warn(`Console errors on ${pageConfig.name}:`, consoleErrors);
      }
    });
  }

  // Optional: simple button presence/click checks defined per-project
  for (const check of config.buttonChecks || []) {
    test(`Button check - "${check.buttonText}" on ${check.pageName}`, async ({ page }) => {
      const pageConfig = config.pages.find((p) => p.name === check.pageName);
      if (!pageConfig) throw new Error(`buttonChecks references unknown pageName "${check.pageName}"`);

      if (pageConfig.requiresAuth) await loginViaUI(page, config);
      await page.goto(`${frontendUrl}${pageConfig.path}`, { waitUntil: 'domcontentloaded' });

      const button = page.getByRole('button', { name: check.buttonText }).first();
      await expect(button, `Button "${check.buttonText}" not found on ${check.pageName}`).toBeVisible();

      if (check.expectAction === 'opens-modal-or-navigates') {
        const urlBefore = page.url();
        await button.click();
        // either a modal/dialog appears, or the URL changed - either counts as "the button does something"
        const modalAppeared = await page.locator('[role="dialog"], .ant-modal').first().isVisible({ timeout: 3000 }).catch(() => false);
        const navigated = page.url() !== urlBefore;
        expect(
          modalAppeared || navigated,
          `Clicking "${check.buttonText}" on ${check.pageName} had no visible effect (no modal, no navigation)`
        ).toBeTruthy();
      }
    });
  }
});
