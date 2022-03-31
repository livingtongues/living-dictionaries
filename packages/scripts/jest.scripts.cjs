const path = require('path')

/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  rootDir: path.join(__dirname, '..'),
  displayName: 'scripts',
  preset: 'ts-jest',
  testEnvironment: "node",
  moduleNameMapper: {
    "[$]lib/(.*)": ["<rootDir>/src/lib/$1"]
  },
  transform: {
    "^.+\\.(ts)$": "ts-jest",
  },
  testMatch: ["<rootDir>/scripts/**/*.test.ts"],
  //   "**/__tests__/**/*.[jt]s?(x)",
  //   "**/?(*.)+(spec|test).[tj]s?(x)"
}

module.exports = config;