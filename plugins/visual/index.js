import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';
import path from 'path';

const visualPlugin = {
  id: 'visual',
  priority: 90,
  isEnabled: (config) => config.visual?.screenshots?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const visualConfig = config.visual || {};
    const baselineDir = visualConfig.baselineDir || 'baselines';

    for (const shot of visualConfig.screenshots || []) {
      test(`Visual - ${shot.name}`, { tag: shot.tags || ['visual'] }, async ({ page }) => {
        if (shot.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(shot.path, context)}`, { waitUntil: 'networkidle' });

        if (shot.waitForSelector) {
          await page.locator(resolveTemplate(shot.waitForSelector, context)).waitFor({ state: 'visible' });
        }

        if (shot.actions) {
          for (const action of shot.actions) {
            if (action.type === 'click') await page.click(resolveTemplate(action.selector, context));
            if (action.type === 'hover') await page.hover(resolveTemplate(action.selector, context));
            if (action.type === 'wait') await page.waitForTimeout(action.ms || 500);
          }
        }

        const screenshotName = `${shot.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`;

        const snapshotOptions = {
          maxDiffPixels: shot.maxDiffPixels ?? visualConfig.maxDiffPixels ?? 100,
          threshold: shot.threshold ?? visualConfig.threshold ?? 0.2,
        };

        if (shot.fullPage) snapshotOptions.fullPage = true;
        if (shot.clip) snapshotOptions.clip = shot.clip;
        if (shot.mask) {
          snapshotOptions.mask = shot.mask.map((sel) => page.locator(resolveTemplate(sel, context)));
        }

        await page.screenshot({ path: path.join('reports', 'screenshots', screenshotName), fullPage: shot.fullPage });

        if (visualConfig.updateBaselines) {
          await page.screenshot({ path: path.join(baselineDir, screenshotName), fullPage: shot.fullPage });
        } else {
          await expect(page).toHaveScreenshot(screenshotName, snapshotOptions);
        }
      });
    }
  },
};

export default visualPlugin;
