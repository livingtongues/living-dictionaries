/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    preset: 'jest-playwright-preset',
    testEnvironmentOptions: {
        "jest-playwright": {
            browsers: ["chromium", "firefox", "webkit"],
            // browsers: ["chromium"],
            // launchOptions: {
            //     headless: false,
            //     slowMo: 600,
            // },
        },
    },
    testMatch: ["**/?(*.)+(spec|test).+(ts|js)"],
    transform: {
        "^.+\\.(ts)$": "ts-jest",
    }
}

module.exports = config;