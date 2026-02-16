import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI
      ? [['junit', { outputFile: 'test-results/results.xml' }] as const]
      : []),
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  webServer: {
    command: 'npx serve ./pages -l 4173 --no-clipboard',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },

  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
