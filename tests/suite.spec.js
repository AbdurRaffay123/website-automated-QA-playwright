import { test } from '@playwright/test';
import { loadConfig } from '../core/config.js';
import { createTestSuite } from '../core/runner.js';

const config = loadConfig();

// Filter plugins via env: PLUGINS=api,ui or TAGS=smoke
const pluginFilter = process.env.PLUGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const tagFilter = process.env.TAGS?.split(',').map((s) => s.trim()).filter(Boolean);

await createTestSuite(test, config, {
  only: pluginFilter,
  tags: tagFilter,
});
