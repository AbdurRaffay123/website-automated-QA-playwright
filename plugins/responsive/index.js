import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { checkLayoutOverlap } from '../../helpers/uiHealth.js';
import { resolveTemplate } from '../../helpers/template.js';

const responsivePlugin = {
  id: 'responsive',
  priority: 85,
  isEnabled: (config) => config.plugins?.responsive === true,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const breakpoints = config.responsive.breakpoints;
    const pagesToCheck = config.responsive.pages || config.pages.filter((p) => p.responsive !== false).slice(0, 5);

    for (const pageConfig of pagesToCheck) {
      for (const [deviceName, viewport] of Object.entries(breakpoints)) {
        test(`Responsive - ${pageConfig.name} @ ${deviceName}`, { tag: ['responsive', deviceName] }, async ({ page }) => {
          await page.setViewportSize(viewport);

          if (pageConfig.requiresAuth) await loginViaUI(page, config);
          await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'domcontentloaded' });

          const selector = pageConfig.expectSelector || 'body';
          await expect(page.locator(selector).first()).toBeVisible({ timeout: 8000 });

          const overlaps = await checkLayoutOverlap(page);
          if (overlaps.length > 0) {
            throw new Error(`Layout overlap on ${deviceName}: ${JSON.stringify(overlaps)}`);
          }

          if (config.responsive.checkHorizontalScroll) {
            const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
            if (hasScroll) {
              test.info().annotations.push({ type: 'responsive-warning', description: `Horizontal scroll detected on ${deviceName}` });
            }
          }
        });
      }
    }
  },
};

export default responsivePlugin;
