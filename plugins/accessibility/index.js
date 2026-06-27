import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';

const accessibilityPlugin = {
  id: 'accessibility',
  priority: 95,
  isEnabled: (config) => config.plugins?.accessibility === true || config.accessibility?.pages?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const a11yConfig = config.accessibility || {};
    const pagesToScan = a11yConfig.pages || config.pages.filter((p) => p.a11y !== false).slice(0, 10);

    for (const pageConfig of pagesToScan) {
      test(`Accessibility - ${pageConfig.name}`, { tag: pageConfig.tags || ['a11y'] }, async ({ page }) => {
        if (pageConfig.requiresAuth) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'domcontentloaded' });

        let AxeBuilder;
        try {
          const axeModule = await import('@axe-core/playwright');
          AxeBuilder = axeModule.default;
        } catch {
          test.skip(true, '@axe-core/playwright not installed — run npm install @axe-core/playwright');
          return;
        }

        const results = await new AxeBuilder({ page })
          .withTags(a11yConfig.tags || ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .exclude(a11yConfig.exclude || [])
          .analyze();

        const violations = results.violations.filter((v) => {
          if (a11yConfig.ignoreRules) {
            return !a11yConfig.ignoreRules.includes(v.id);
          }
          return true;
        });

        if (violations.length > 0) {
          const summary = violations.map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`).join('\n');
          test.info().annotations.push({ type: 'a11y-violations', description: summary });

          if (a11yConfig.failOnViolations !== false) {
            throw new Error(`Accessibility violations on ${pageConfig.name}:\n${summary}`);
          }
        }

        if (a11yConfig.checkKeyboardNav) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => document.activeElement?.tagName);
          if (!focused || focused === 'BODY') {
            test.info().annotations.push({ type: 'a11y-warning', description: 'No focusable element on Tab' });
          }
        }
      });
    }
  },
};

export default accessibilityPlugin;
