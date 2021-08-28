/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    ...require('./jest.config'),
    testEnvironmentOptions: {
        "jest-playwright": {
            browsers: ["chromium"], // "firefox", "webkit"
            launchOptions: {
                headless: false,
                slowMo: 1000,
            },
        },
    },
}

module.exports = config;