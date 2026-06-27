import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { startNetworkMonitor, assertNoNetworkErrors, verifyNetworkAction } from '../../helpers/network.js';
import { attachPageListeners } from '../../helpers/evidence.js';
import { resolveTemplate } from '../../helpers/template.js';

const networkPlugin = {
  id: 'network',
  priority: 35,
  isEnabled: (config) => config.network?.actions?.length > 0 || config.network?.monitorPages?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const action of config.network?.actions || []) {
      test(`Network - ${action.name}`, { tag: action.tags }, async ({ page }) => {
        attachPageListeners(page, context);
        const monitor = startNetworkMonitor(page, context, config.network);

        if (action.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(action.path, context)}`, { waitUntil: 'domcontentloaded' });

        if (action.triggerSelector) {
          await page.click(resolveTemplate(action.triggerSelector, context));
          await page.waitForTimeout(action.waitMs || 1000);
        }

        if (action.expectRequest) {
          verifyNetworkAction(context, action.expectRequest);
        }

        if (action.expectNoErrors !== false) {
          assertNoNetworkErrors(context, { ignore: action.ignoreErrors || [] });
        }

        if (action.forbiddenUrls?.length > 0) {
          const logs = context.networkLog || [];
          for (const forbidden of action.forbiddenUrls) {
            const found = logs.some((l) => l.url.includes(forbidden) && l.status >= 400);
            expect(found, `Forbidden URL should not fail: ${forbidden}`).toBeFalsy();
          }
        }
      });
    }

    for (const pageConfig of config.network?.monitorPages || []) {
      test(`Network monitor - ${pageConfig.name}`, { tag: pageConfig.tags || ['network'] }, async ({ page }) => {
        attachPageListeners(page, context);
        startNetworkMonitor(page, context, config.network);

        if (pageConfig.requiresAuth) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'networkidle' });

        assertNoNetworkErrors(context, { ignore: pageConfig.ignoreErrors || config.network?.ignoreErrors || [] });
      });
    }
  },
};

export default networkPlugin;
