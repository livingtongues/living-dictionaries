/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    projects: [
        './tests/jest.ts.cjs',
        './tests/jest.svelte.cjs',
        // './scripts/jest.scripts.cjs',
    ],
};

module.exports = config;
