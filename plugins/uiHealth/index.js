import { loginViaUI } from '../../helpers/uiLogin.js';
import { runUiHealthChecks, checkBrokenImages, checkLayoutOverlap } from '../../helpers/uiHealth.js';
import { resolveTemplate } from '../../helpers/template.js';

const uiHealthPlugin = {
  id: 'uiHealth',
  priority: 25,
  isEnabled: (config) => config.plugins?.uiHealth === true || config.uiHealth?.pages?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const healthConfig = config.uiHealth || {};
    const pagesToCheck = healthConfig.pages || config.pages.filter((p) => p.healthCheck !== false);

    for (const pageConfig of pagesToCheck) {
      test(`UI Health - ${pageConfig.name}`, { tag: pageConfig.tags || ['health'] }, async ({ page }) => {
        if (pageConfig.requiresAuth) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'networkidle' });

        const issues = await runUiHealthChecks(page, healthConfig, context);

        const brokenImages = await checkBrokenImages(page);
        if (brokenImages.length > 0) {
          issues.push({ type: 'broken-images', details: brokenImages });
        }

        if (healthConfig.checkOverlap) {
          const overlaps = await checkLayoutOverlap(page);
          if (overlaps.length > 0) {
            issues.push({ type: 'layout-overlap', details: overlaps });
          }
        }

        const criticalTypes = healthConfig.failOn || ['blank-page', 'js-errors', 'network-errors', 'broken-images'];
        const critical = issues.filter((i) => criticalTypes.includes(i.type));

        if (critical.length > 0 && !pageConfig.knownIssue) {
          throw new Error(`UI health check failed for ${pageConfig.name}: ${JSON.stringify(critical)}`);
        }

        if (issues.length > 0) {
          test.info().annotations.push({ type: 'health-warning', description: JSON.stringify(issues) });
        }
      });
    }
  },
};

export default uiHealthPlugin;
