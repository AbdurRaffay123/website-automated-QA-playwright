import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';

const searchPlugin = {
  id: 'search',
  priority: 55,
  isEnabled: (config) => config.search.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const searchTest of config.search) {
      for (const query of searchTest.queries || [searchTest]) {
        test(`Search - ${searchTest.name}: "${query.query || query.text}"`, { tag: searchTest.tags }, async ({ page }) => {
          if (searchTest.requiresAuth !== false) await loginViaUI(page, config);
          await page.goto(`${frontendUrl}${resolveTemplate(searchTest.path, context)}`, { waitUntil: 'domcontentloaded' });

          const inputSelector = resolveTemplate(searchTest.inputSelector, context);
          const searchQuery = resolveTemplate(query.query || query.text, context);

          await page.fill(inputSelector, searchQuery);

          if (searchTest.submitSelector) {
            await page.click(resolveTemplate(searchTest.submitSelector, context));
          } else {
            await page.keyboard.press('Enter');
          }

          await page.waitForTimeout(searchTest.waitMs || 500);

          const resultsSelector = resolveTemplate(searchTest.resultsSelector || 'body', context);
          const resultsText = await page.locator(resultsSelector).textContent();

          if (query.expectContains) {
            const expected = resolveTemplate(query.expectContains, context);
            const caseSensitive = query.caseSensitive ?? searchTest.caseSensitive ?? false;
            const haystack = caseSensitive ? resultsText : resultsText?.toLowerCase();
            const needle = caseSensitive ? expected : String(expected).toLowerCase();
            expect(haystack).toContain(needle);
          }

          if (query.expectEmpty || query.expectNoResults) {
            const emptySelector = resolveTemplate(
              query.emptySelector || searchTest.emptySelector || '.empty-state, [data-empty]',
              context
            );
            const isEmpty = await page.locator(emptySelector).isVisible().catch(() => false);
            const rowCount = await page.locator(resolveTemplate(searchTest.rowSelector || 'tbody tr', context)).count();
            expect(isEmpty || rowCount === 0).toBeTruthy();
          }

          if (query.expectMinResults) {
            const rowCount = await page.locator(resolveTemplate(searchTest.rowSelector || 'tbody tr', context)).count();
            expect(rowCount).toBeGreaterThanOrEqual(query.expectMinResults);
          }
        });
      }
    }
  },
};

export default searchPlugin;
