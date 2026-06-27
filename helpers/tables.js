import { resolveTemplate } from './template.js';

/**
 * Generic table/grid testing helpers.
 */
export async function testTableSort(page, tableConfig, context) {
  const tableSelector = resolveTemplate(tableConfig.selector, context);
  for (const sort of tableConfig.sorting || []) {
    const headerSelector = resolveTemplate(sort.columnSelector, context);
    await page.click(headerSelector);
    await page.waitForTimeout(500);

    if (sort.expectOrder) {
      const cells = page.locator(`${tableSelector} ${sort.cellSelector || 'td'}`);
      const texts = await cells.allTextContents();
      const firstN = texts.slice(0, sort.expectOrder.length);
      for (let i = 0; i < sort.expectOrder.length; i++) {
        if (sort.expectOrder[i] !== firstN[i]) {
          throw new Error(`Sort order mismatch at index ${i}: expected "${sort.expectOrder[i]}", got "${firstN[i]}"`);
        }
      }
    }
  }
}

export async function testTableFilter(page, tableConfig, context) {
  for (const filter of tableConfig.filtering || []) {
    const inputSelector = resolveTemplate(filter.inputSelector, context);
    const value = resolveTemplate(filter.value, context);
    await page.fill(inputSelector, value);
    if (filter.applySelector) {
      await page.click(resolveTemplate(filter.applySelector, context));
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(500);

    if (filter.expectRowCount !== undefined) {
      const rows = page.locator(resolveTemplate(tableConfig.rowSelector || `${tableConfig.selector} tbody tr`, context));
      const count = await rows.count();
      if (count !== filter.expectRowCount) {
        throw new Error(`Filter expected ${filter.expectRowCount} rows, got ${count}`);
      }
    }

    if (filter.expectContains) {
      const tableText = await page.locator(resolveTemplate(tableConfig.selector, context)).textContent();
      if (!tableText?.includes(filter.expectContains)) {
        throw new Error(`Filter result should contain "${filter.expectContains}"`);
      }
    }
  }
}

export async function testTablePagination(page, tableConfig, context) {
  const pagination = tableConfig.pagination;
  if (!pagination) return;

  const nextSelector = resolveTemplate(pagination.nextSelector, context);
  const prevSelector = pagination.prevSelector ? resolveTemplate(pagination.prevSelector, context) : null;

  const rowsBefore = await page.locator(resolveTemplate(tableConfig.rowSelector || `${tableConfig.selector} tbody tr`, context)).count();
  await page.click(nextSelector);
  await page.waitForTimeout(500);
  const rowsAfter = await page.locator(resolveTemplate(tableConfig.rowSelector || `${tableConfig.selector} tbody tr`, context)).count();

  if (pagination.expectDifferentPage && rowsBefore === rowsAfter && rowsBefore > 0) {
    // Pages may have same row count but different content — check page indicator if configured
    if (pagination.pageIndicatorSelector) {
      const indicator = await page.locator(resolveTemplate(pagination.pageIndicatorSelector, context)).textContent();
      if (!indicator || indicator.includes('1')) {
        throw new Error('Pagination next did not advance page');
      }
    }
  }

  if (prevSelector) {
    await page.click(prevSelector);
    await page.waitForTimeout(500);
  }
}

export async function testTableSearch(page, tableConfig, context) {
  const search = tableConfig.search;
  if (!search) return;

  const inputSelector = resolveTemplate(search.inputSelector, context);
  const query = resolveTemplate(search.query, context);
  await page.fill(inputSelector, query);
  if (search.submitSelector) {
    await page.click(resolveTemplate(search.submitSelector, context));
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);

  if (search.expectContains) {
    const tableText = await page.locator(resolveTemplate(tableConfig.selector, context)).textContent();
    if (!tableText?.toLowerCase().includes(String(search.expectContains).toLowerCase())) {
      throw new Error(`Search result should contain "${search.expectContains}"`);
    }
  }

  if (search.expectEmpty) {
    const rows = await page.locator(resolveTemplate(tableConfig.rowSelector || `${tableConfig.selector} tbody tr`, context)).count();
    if (rows > 0 && !search.allowEmptyStateRow) {
      throw new Error('Search expected empty results');
    }
  }
}

export async function testTableBulkAction(page, tableConfig, context) {
  const bulk = tableConfig.bulkActions;
  if (!bulk) return;

  if (bulk.selectAllSelector) {
    await page.click(resolveTemplate(bulk.selectAllSelector, context));
  } else if (bulk.rowCheckboxSelector) {
    await page.click(resolveTemplate(bulk.rowCheckboxSelector, context));
  }

  await page.click(resolveTemplate(bulk.actionSelector, context));

  if (bulk.confirmSelector) {
    await page.click(resolveTemplate(bulk.confirmSelector, context));
  }

  if (bulk.expectNotification) {
    await page.waitForSelector(resolveTemplate(bulk.expectNotification, context), { timeout: 5000 });
  }
}

export async function getTableRowCount(page, tableConfig, context) {
  const rowSelector = resolveTemplate(tableConfig.rowSelector || `${tableConfig.selector} tbody tr`, context);
  return page.locator(rowSelector).count();
}
