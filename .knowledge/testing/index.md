# Testing knowledge

Durable conventions/gotchas for verifying LD beyond what the code shows.

## Pages
- [browser-deep-flow.md](./browser-deep-flow.md) — the puppeteer-core deep-flow harness
  (`site/e2e/achi-flow.mjs`): why puppeteer-core over Playwright, the self-booting `node build`
  pattern, and the three gotchas that bite headless browser-eval E2E (locale, ambient PORT,
  innerText-vs-textContent).
