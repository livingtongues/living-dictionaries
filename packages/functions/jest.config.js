// const path = require('path')

/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  // rootDir: path.join(__dirname, '..'),
  // displayName: 'functions-scripts',
  preset: 'ts-jest',
  testEnvironment: "node",
  // transform: {
  //   "^.+\\.(ts)$": "ts-jest",
  // },
  testMatch: ["**/scripts/import/**/*.test.ts"],
  // testMatch: ["<rootDir>/functions/scripts/**/*.test.ts"],
}

module.exports = config;