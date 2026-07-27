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
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/results.xml' }] as const] : []),
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  // Two servers over the same fixture directory: localhost:4173 and
  // 127.0.0.1:4174 are different origins, which is all a cross-origin iframe
  // needs (different host *and* port, so no same-origin shortcuts apply).
  webServer: [
    {
      command: 'npx serve ./pages -l 4173 --no-clipboard',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx serve ./pages -l 4174 --no-clipboard',
      port: 4174,
      reuseExistingServer: !process.env.CI,
    },
  ],

  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
