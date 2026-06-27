import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { attachPageListeners } from '../../helpers/evidence.js';
import { resolveTemplate } from '../../helpers/template.js';

const dashboardPlugin = {
  id: 'dashboard',
  priority: 75,
  isEnabled: (config) => config.dashboards.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const dashboard of config.dashboards) {
      test(`Dashboard - ${dashboard.name}`, { tag: dashboard.tags }, async ({ page }) => {
        attachPageListeners(page, context);

        if (dashboard.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(dashboard.path, context)}`, { waitUntil: 'networkidle' });

        for (const widget of dashboard.widgets || []) {
          const selector = resolveTemplate(widget.selector, context);
          await expect(page.locator(selector).first(), `Widget "${widget.name}" not visible`).toBeVisible({ timeout: 10000 });

          if (widget.expectMinValue !== undefined) {
            const text = await page.locator(selector).textContent();
            const numMatch = text?.match(/[\d,.]+/);
            if (numMatch) {
              const num = parseFloat(numMatch[0].replace(/,/g, ''));
              expect(num).toBeGreaterThanOrEqual(widget.expectMinValue);
            }
          }
        }

        for (const kpi of dashboard.kpis || []) {
          const selector = resolveTemplate(kpi.selector, context);
          await expect(page.locator(selector).first(), `KPI "${kpi.name}" not visible`).toBeVisible();
          if (kpi.expectPattern) {
            const text = await page.locator(selector).textContent();
            expect(text).toMatch(new RegExp(kpi.expectPattern));
          }
        }

        for (const chart of dashboard.charts || []) {
          const selector = resolveTemplate(chart.selector, context);
          await expect(page.locator(selector).first(), `Chart "${chart.name}" not rendered`).toBeVisible({ timeout: 10000 });

          if (chart.expectData) {
            const hasContent = await page.locator(selector).evaluate((el) => el.children.length > 0 || el.textContent?.trim().length > 0);
            expect(hasContent).toBeTruthy();
          }
        }

        for (const card of dashboard.cards || []) {
          await expect(page.locator(resolveTemplate(card.selector, context)).first()).toBeVisible();
        }

        if (context.pageErrors?.length > 0) {
          throw new Error(`Dashboard JS errors: ${context.pageErrors.map((e) => e.message).join(', ')}`);
        }
      });
    }
  },
};

export default dashboardPlugin;
