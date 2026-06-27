import { logPerformance } from '../core/context.js';

/**
 * Performance measurement and threshold checking.
 */
export async function measurePageLoad(page, context, label) {
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav
      ? {
          domContentLoaded: nav.domContentLoadedEventEnd,
          loadComplete: nav.loadEventEnd,
          ttfb: nav.responseStart - nav.requestStart,
        }
      : null;
  });

  if (timing) {
    logPerformance(context, { type: 'page-load', label, ...timing });
  }

  return timing;
}

export function checkPerformanceThresholds(context, thresholds = {}) {
  const warnings = [];
  const defaults = {
    pageLoadMs: 5000,
    apiResponseMs: 2000,
    jsBundleBytes: 2 * 1024 * 1024,
    imageBytes: 500 * 1024,
  };
  const limits = { ...defaults, ...thresholds };

  for (const entry of context.performanceLog || []) {
    if (entry.type === 'page-load' && entry.loadComplete > limits.pageLoadMs) {
      warnings.push(`Slow page load "${entry.label}": ${Math.round(entry.loadComplete)}ms (limit ${limits.pageLoadMs}ms)`);
    }
    if (entry.type === 'api-response' && entry.duration > limits.apiResponseMs) {
      warnings.push(`Slow API "${entry.label}": ${Math.round(entry.duration)}ms (limit ${limits.apiResponseMs}ms)`);
    }
    if (entry.type === 'resource' && entry.resourceType === 'script' && entry.size > limits.jsBundleBytes) {
      warnings.push(`Large JS bundle "${entry.url}": ${Math.round(entry.size / 1024)}KB`);
    }
    if (entry.type === 'resource' && entry.resourceType === 'image' && entry.size > limits.imageBytes) {
      warnings.push(`Large image "${entry.url}": ${Math.round(entry.size / 1024)}KB`);
    }
  }

  context.performanceWarnings = warnings;
  return warnings;
}

export function startPerformanceMonitor(page, context) {
  page.on('response', async (response) => {
    const request = response.request();
    const url = response.url();
    const resourceType = request.resourceType();

    if (url.includes('/api/') || resourceType === 'fetch' || resourceType === 'xhr') {
      const timing = response.request().timing?.();
      logPerformance(context, {
        type: 'api-response',
        label: url,
        url,
        duration: timing ? timing.responseEnd : undefined,
        status: response.status(),
      });
    }

    if (['script', 'image', 'stylesheet'].includes(resourceType)) {
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0', 10);
      logPerformance(context, {
        type: 'resource',
        url,
        resourceType,
        size,
        status: response.status(),
      });
    }
  });
}
