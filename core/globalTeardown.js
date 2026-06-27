import { request } from '@playwright/test';
import { loadConfig } from './config.js';
import { getAuthHeaders } from './auth.js';
import { cleanupTaggedData, formatCleanupSummary } from './cleanup.js';

export default async function globalTeardown() {
  try {
    const config = loadConfig();

    if (!Array.isArray(config.cleanupTargets) || config.cleanupTargets.length === 0) {
      return;
    }

    const api = await request.newContext();
    try {
      const authHeaders = await getAuthHeaders(api, config);
      const results = await cleanupTaggedData(api, config, authHeaders);
      console.log(`[cleanup] ${formatCleanupSummary(results)}`);
    } finally {
      await api.dispose();
    }
  } catch (error) {
    console.warn(`[cleanup] Teardown cleanup skipped: ${error.message}`);
  }
}
