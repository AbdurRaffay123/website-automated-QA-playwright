import { request } from '@playwright/test';
import { loadConfig } from './config.js';
import { getAuthHeaders } from './auth.js';
import { cleanupTaggedData, formatCleanupSummary } from './cleanup.js';

async function main() {
  const config = loadConfig();

  if (!Array.isArray(config.cleanupTargets) || config.cleanupTargets.length === 0) {
    console.log('No cleanupTargets configured for this project.');
    return;
  }

  const api = await request.newContext();

  try {
    const authHeaders = await getAuthHeaders(api, config);
    const results = await cleanupTaggedData(api, config, authHeaders);
    console.log(formatCleanupSummary(results));
  } finally {
    await api.dispose();
  }
}

main().catch((error) => {
  console.error(`Cleanup failed: ${error.message}`);
  process.exitCode = 1;
});
