import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['api-tests/**/*.spec.js', 'ui-tests/**/*.spec.js'],
  timeout: 30_000,
  fullyParallel: false, // keep false: API tests chain values between steps (create -> read -> update -> delete)
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
