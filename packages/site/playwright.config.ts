import { type PlaywrightTestConfig, devices } from '@playwright/test';

// consider adding reporters https://playwright.dev/docs/test-reporters

const config: PlaywrightTestConfig = {
  // projects: [
  //   {
  //     name: 'Google Chrome',
  //     use: { ...devices['Desktop Chrome'], channel: 'chrome' }, // or 'chrome-beta'
  //   },
  // ], // from https://github.com/microsoft/playwright/issues/14434 and https://playwright.dev/docs/browsers#google-chrome--microsoft-edge
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173'
  },
  // webServer: {
  //   reuseExistingServer: !process.env.CI,
  //   command: 'npm run build && npm run preview',
  //   port: 4173,
  // },
  testDir: 'e2e'
};

export default config;
