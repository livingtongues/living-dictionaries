import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		reuseExistingServer: !process.env.CI,
		command: 'npm run build && npm run preview',
		port: 4173,
	},
	testDir: 'e2e'
};

export default config;
