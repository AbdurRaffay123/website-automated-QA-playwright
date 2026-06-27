import fs from 'fs';
import path from 'path';
import { defineConfig } from '@playwright/test';

function getProjectWorkers() {
  const projectName = process.env.PROJECT;
  if (!projectName) return undefined;

  const configPath = projectName.endsWith('.json')
    ? path.resolve(projectName)
    : path.resolve('configs', `${projectName}.json`);

  if (!fs.existsSync(configPath)) return undefined;

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config.workers;
}

const projectWorkers = getProjectWorkers();

export default defineConfig({
  testDir: '.',
  testMatch: ['api-tests/**/*.spec.js', 'ui-tests/**/*.spec.js'],
  timeout: 30_000,
  fullyParallel: false, // keep false: API tests chain values between steps (create -> read -> update -> delete)
  ...(projectWorkers !== undefined ? { workers: projectWorkers } : {}),
  globalTeardown: './core/globalTeardown.js',
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
