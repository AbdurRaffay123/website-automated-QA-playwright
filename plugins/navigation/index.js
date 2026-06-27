import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';

const navigationPlugin = {
  id: 'navigation',
  priority: 70,
  isEnabled: (config) => {
    const nav = config.navigation;
    return nav && (nav.menus?.length > 0 || nav.tabs?.length > 0 || nav.breadcrumbs || nav.deepLinks?.length > 0);
  },

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const nav = config.navigation;

    if (nav.menus?.length > 0) {
      test('Navigation - all menu items', { tag: nav.tags }, async ({ page }) => {
        if (nav.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${nav.startPath || '/'}`, { waitUntil: 'domcontentloaded' });

        for (const item of nav.menus) {
          const selector = resolveTemplate(item.selector, context);
          await page.click(selector);
          await page.waitForTimeout(500);

          if (item.expectPath) {
            await page.waitForURL(resolveTemplate(item.expectPath, context), { timeout: 8000 });
          }
          if (item.expectSelector) {
            await expect(page.locator(resolveTemplate(item.expectSelector, context)).first()).toBeVisible();
          }
        }
      });
    }

    if (nav.sidebar?.length > 0) {
      test('Navigation - sidebar links', { tag: nav.tags }, async ({ page }) => {
        if (nav.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${nav.startPath || '/dashboard'}`, { waitUntil: 'domcontentloaded' });

        for (const link of nav.sidebar) {
          await page.click(resolveTemplate(link.selector, context));
          if (link.expectPath) {
            await page.waitForURL(resolveTemplate(link.expectPath, context), { timeout: 8000 });
          }
        }
      });
    }

    if (nav.tabs?.length > 0) {
      for (const tabGroup of nav.tabs) {
        test(`Navigation - tabs: ${tabGroup.name}`, { tag: tabGroup.tags }, async ({ page }) => {
          if (nav.requiresAuth !== false) await loginViaUI(page, config);
          await page.goto(`${frontendUrl}${resolveTemplate(tabGroup.path, context)}`, { waitUntil: 'domcontentloaded' });

          for (const tab of tabGroup.items) {
            await page.click(resolveTemplate(tab.selector, context));
            if (tab.expectSelector) {
              await expect(page.locator(resolveTemplate(tab.expectSelector, context)).first()).toBeVisible();
            }
          }
        });
      }
    }

    if (nav.breadcrumbs) {
      test('Navigation - breadcrumbs', { tag: nav.tags }, async ({ page }) => {
        if (nav.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(nav.breadcrumbs.path, context)}`, { waitUntil: 'domcontentloaded' });

        const crumbs = page.locator(resolveTemplate(nav.breadcrumbs.selector, context));
        const count = await crumbs.count();
        expect(count).toBeGreaterThanOrEqual(nav.breadcrumbs.expectMinItems || 1);

        if (nav.breadcrumbs.clickFirst) {
          await crumbs.first().click();
          await page.waitForTimeout(500);
        }
      });
    }

    if (nav.deepLinks?.length > 0) {
      for (const link of nav.deepLinks) {
        test(`Navigation - deep link: ${link.name}`, { tag: link.tags }, async ({ page }) => {
          if (link.requiresAuth !== false) await loginViaUI(page, config);
          const response = await page.goto(`${frontendUrl}${resolveTemplate(link.path, context)}`, { waitUntil: 'domcontentloaded' });

          if (link.expect404) {
            expect(response?.status()).toBeGreaterThanOrEqual(404);
          } else {
            expect(response?.status()).toBeLessThan(400);
            if (link.expectSelector) {
              await expect(page.locator(resolveTemplate(link.expectSelector, context)).first()).toBeVisible();
            }
          }
        });
      }
    }

    if (nav.backForward) {
      test('Navigation - back/forward buttons', { tag: nav.tags }, async ({ page }) => {
        if (nav.requiresAuth !== false) await loginViaUI(page, config);
        const startUrl = `${frontendUrl}${nav.backForward.startPath || '/dashboard'}`;
        await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
        await page.goto(`${frontendUrl}${resolveTemplate(nav.backForward.navigateTo, context)}`, { waitUntil: 'domcontentloaded' });

        await page.goBack();
        expect(page.url()).toContain(nav.backForward.startPath || '/dashboard');

        await page.goForward();
        expect(page.url()).toContain(resolveTemplate(nav.backForward.navigateTo, context).replace(/\*\*/g, ''));
      });
    }
  },
};

export default navigationPlugin;
