import { loginViaUI } from '../../helpers/uiLogin.js';
import {
  testTableSort,
  testTableFilter,
  testTablePagination,
  testTableSearch,
  testTableBulkAction,
  getTableRowCount,
} from '../../helpers/tables.js';
import { resolveTemplate } from '../../helpers/template.js';

const tablesPlugin = {
  id: 'tables',
  priority: 60,
  isEnabled: (config) => config.tables.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const table of config.tables) {
      test(`Table - ${table.name}`, { tag: table.tags }, async ({ page }) => {
        if (table.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(table.path, context)}`, { waitUntil: 'domcontentloaded' });

        if (table.expectMinRows !== undefined) {
          const count = await getTableRowCount(page, table, context);
          if (count < table.expectMinRows) {
            throw new Error(`Expected at least ${table.expectMinRows} rows, got ${count}`);
          }
        }

        if (table.sorting) await testTableSort(page, table, context);
        if (table.filtering) await testTableFilter(page, table, context);
        if (table.search) await testTableSearch(page, table, context);
        if (table.pagination) await testTablePagination(page, table, context);
        if (table.bulkActions) await testTableBulkAction(page, table, context);

        if (table.columnVisibility) {
          for (const col of table.columnVisibility) {
            if (col.toggleSelector) {
              await page.click(resolveTemplate(col.toggleSelector, context));
              const header = page.locator(resolveTemplate(col.headerSelector, context));
              if (col.visible) {
                await header.waitFor({ state: 'visible' });
              } else {
                await header.waitFor({ state: 'hidden' });
              }
            }
          }
        }

        if (table.export) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
            page.click(resolveTemplate(table.export.buttonSelector, context)),
          ]);
          if (table.export.expectDownload && !download) {
            throw new Error('Expected file download on export');
          }
        }

        if (table.refresh) {
          const countBefore = await getTableRowCount(page, table, context);
          await page.click(resolveTemplate(table.refresh.selector, context));
          await page.waitForTimeout(1000);
          const countAfter = await getTableRowCount(page, table, context);
          if (table.refresh.expectSameCount && countBefore !== countAfter) {
            throw new Error(`Refresh changed row count from ${countBefore} to ${countAfter}`);
          }
        }

        if (table.recordCountSelector) {
          const countText = await page.locator(resolveTemplate(table.recordCountSelector, context)).textContent();
          if (table.expectRecordCount && !countText?.includes(String(table.expectRecordCount))) {
            throw new Error(`Expected record count ${table.expectRecordCount}, got "${countText}"`);
          }
        }
      });
    }
  },
};

export default tablesPlugin;
