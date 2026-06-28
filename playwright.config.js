import fs from 'fs';
import path from 'path';
import { defineConfig } from '@playwright/test';

function loadProjectConfig() {
  const projectName = process.env.PROJECT;
  if (!projectName) return {};

  const configPath = projectName.endsWith('.json')
    ? path.resolve(projectName)
    : path.resolve('configs', `${projectName}.json`);

  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const projectConfig = loadProjectConfig();
const browsers = (process.env.BROWSERS || 'chromium').split(',').map((b) => b.trim());

const browserProjects = browsers.map((browser) => ({
  name: browser,
  use: {
    browserName: browser === 'webkit' ? 'webkit' : browser === 'firefox' ? 'firefox' : 'chromium',
  },
}));

// Canonical entry: tests/suite.spec.js (plugin-based unified runner).
// Legacy api-tests/ and ui-tests/ are excluded; pass them explicitly on the CLI
// (e.g. npm run test:api) if you still need the old entry points.
export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.js'],
  timeout: projectConfig.timeout || 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixels: projectConfig.visual?.maxDiffPixels ?? 100,
    },
  },
  fullyParallel: false,
  workers: projectConfig.workers ?? 1,
  retries: projectConfig.retry?.maxRetries ?? projectConfig.retries ?? 0,
  globalTeardown: './core/globalTeardown.js',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['./reporting/qaReporter.js', { outputDir: 'reports/qa' }],
  ],
  use: {
    headless: process.env.HEADED !== 'true',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: projectConfig.frontendUrl || projectConfig.baseUrl,
  },
  projects: browserProjects.length > 1 ? browserProjects : undefined,
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}/{testFilePath}/{arg}{ext}',
});
