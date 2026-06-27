import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';

const rolesPlugin = {
  id: 'roles',
  priority: 45,
  isEnabled: (config) => config.roles.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const role of config.roles) {
      test.describe(`Role - ${role.name}`, () => {
        const credentials = {
          username: role.username || role.email,
          password: role.password,
        };

        if (role.accessiblePages?.length > 0) {
          for (const pageAccess of role.accessiblePages) {
            test(`${role.name} can access ${pageAccess.name}`, { tag: role.tags }, async ({ page }) => {
              await loginViaUI(page, config, {
                username: credentials.username,
                password: credentials.password,
                ...config.uiLogin,
              });

              const response = await page.goto(`${frontendUrl}${resolveTemplate(pageAccess.path, context)}`, {
                waitUntil: 'domcontentloaded',
              });

              expect(response?.status()).toBeLessThan(400);
              if (pageAccess.expectSelector) {
                await expect(page.locator(resolveTemplate(pageAccess.expectSelector, context)).first()).toBeVisible();
              }
            });
          }
        }

        if (role.hiddenPages?.length > 0) {
          for (const hidden of role.hiddenPages) {
            test(`${role.name} cannot access ${hidden.name}`, { tag: role.tags }, async ({ page }) => {
              await loginViaUI(page, config, {
                username: credentials.username,
                password: credentials.password,
                ...config.uiLogin,
              });

              const response = await page.goto(`${frontendUrl}${resolveTemplate(hidden.path, context)}`, {
                waitUntil: 'domcontentloaded',
              });

              const isForbidden =
                response?.status() === 403 ||
                response?.status() === 404 ||
                (hidden.expectSelector && !(await page.locator(resolveTemplate(hidden.expectSelector, context)).isVisible().catch(() => false)));

              expect(isForbidden, `${role.name} should not access ${hidden.name}`).toBeTruthy();
            });
          }
        }

        if (role.forbiddenActions?.length > 0) {
          for (const action of role.forbiddenActions) {
            test(`${role.name} forbidden: ${action.name}`, { tag: role.tags }, async ({ page }) => {
              await loginViaUI(page, config, {
                username: credentials.username,
                password: credentials.password,
                ...config.uiLogin,
              });

              await page.goto(`${frontendUrl}${resolveTemplate(action.path, context)}`, { waitUntil: 'domcontentloaded' });

              const button = page.locator(resolveTemplate(action.selector, context));
              const isVisible = await button.isVisible().catch(() => false);
              const isDisabled = isVisible ? await button.isDisabled().catch(() => false) : true;

              expect(!isVisible || isDisabled, `Action "${action.name}" should be hidden or disabled for ${role.name}`).toBeTruthy();
            });
          }
        }
      });
    }
  },
};

export default rolesPlugin;
