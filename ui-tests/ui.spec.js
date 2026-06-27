import { test } from '@playwright/test';
import { loadConfig } from '../core/config.js';
import { createTestSuite } from '../core/runner.js';

const config = loadConfig();
await createTestSuite(test, config, { only: ['ui', 'uiHealth'] });
