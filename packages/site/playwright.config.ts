import { type PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
	projects: [
		{
			name: 'Google Chrome',
			use: { ...devices['Desktop Chrome'], channel: 'chrome' }, // or 'chrome-beta'
		},
		// {
		// 	name: 'Microsoft Edge',
		// 	use: { ...devices['Desktop Edge'], channel: 'msedge' }, // or "msedge-beta" or 'msedge-dev'
		// },
	],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173'
	},
	webServer: {
		reuseExistingServer: !process.env.CI,
		command: 'npm run build && npm run preview',
		port: 4173,
	},
	testDir: 'e2e'
};

export default config;
