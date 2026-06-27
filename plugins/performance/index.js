import { loginViaUI } from '../../helpers/uiLogin.js';
import { measurePageLoad, checkPerformanceThresholds, startPerformanceMonitor } from '../../helpers/performance.js';
import { attachPageListeners } from '../../helpers/evidence.js';
import { resolveTemplate } from '../../helpers/template.js';

const performancePlugin = {
  id: 'performance',
  priority: 80,
  isEnabled: (config) => config.plugins?.performance === true || config.performance?.pages?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const perfConfig = config.performance || {};
    const pagesToCheck = perfConfig.pages || config.pages.slice(0, 10);

    for (const pageConfig of pagesToCheck) {
      test(`Performance - ${pageConfig.name}`, { tag: pageConfig.tags || ['performance'] }, async ({ page }) => {
        attachPageListeners(page, context);
        startPerformanceMonitor(page, context);

        if (pageConfig.requiresAuth) await loginViaUI(page, config);

        const start = Date.now();
        await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - start;

        await measurePageLoad(page, context, pageConfig.name);
        context.performanceLog.push({ type: 'page-load', label: pageConfig.name, loadComplete: loadTime });

        const warnings = checkPerformanceThresholds(context, perfConfig.thresholds);

        if (warnings.length > 0) {
          test.info().annotations.push({ type: 'performance-warning', description: warnings.join('; ') });
        }

        const failOnSlow = perfConfig.failOnSlow || false;
        if (failOnSlow && warnings.length > 0) {
          throw new Error(`Performance thresholds exceeded:\n${warnings.join('\n')}`);
        }
      });
    }
  },
};

export default performancePlugin;
