# E2E Testing w/ Playwright

[Overview Video](https://vimeo.com/539258111/f857aaa64e)

## Playwright Notes

- [Playwright Docs](https://playwright.dev/)
- Easily record user interactions: `npx playwright codegen hvsb.app`

## Jest Test Runner Notes

- For use in CI or for being able to run multiple tests and add assertions, we are using Jest and [Jest Playwright Preset](https://github.com/playwright-community/jest-playwright), run `npm t` (shorthand for `npm run test`) to run all tests.
- w/o VSCode, individual tests can be run by installing Jest globally `npm i -g jest` and then running `jest homepage` (all test files matching that glob pattern will be run) or by editing the package.json scripts to target a specific file
- w/ VSCode, use recommended extension `vscode-jest-runner` to get "Run | Debug" codelens shortcuts above each individual test to run or debug. These commands will use the "individual-test" config that will only use 1 browser, turn off headless mode, and slow down the test so we can observe each step
- Learn more about assertions: https://jestjs.io/docs/using-matchers
- Note: the jest.config.js testEnvironmentOptions configure which browsers run the tests and if you want to turn headless mode off and slowMo on to be able to watch tests run in a browser
- Note: that playwright has a bit of boilerplate code to instantiate a browser and page environment, that jest-playwright-preset enables us to remove this boilerplate code and to test across different browser types easily. Read https://www.carlrippon.com/getting-started-with-playwright/ to learn more.
- Not used: modify the testMatch patterns in jest.config.js and then run the "Debug Jest Test" preset on the debug panel. Turn headless mode off if you also want visual testing at the same time

## Triggering Test Runs

- Presently, tests can be triggered by going into the repo and clicking on a job and "Re-run jobs" or by modifying a file and pushing (from local or online). If desired, David can set up an HTTP trigger endpoint if wanting to automate the process on every publish as mentioned in: https://dev.to/rikurouvila/how-to-trigger-a-github-action-with-an-htt-request-545

### Exploring Playwright without a test runner

- To see how Playwright works by itself w/o a test runner, run `node tests/e2e/essentials.cjs` to see sample (1st time, Playwright binaries will have to download)

### Helpful Jest + Playwright resources

- https://www.carlrippon.com/getting-started-with-playwright/
- https://dilshani.medium.com/start-ui-tests-with-playwright-jest-typescript-8dcbf4646bcb
