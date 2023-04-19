import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
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
