# Testing knowledge

Durable conventions/gotchas for verifying LD beyond what the code shows.

## Pages
- [svelte-look-page-stories.md](./svelte-look-page-stories.md) — writing `_page.stories.ts`:
  svelte-look mocks `$app/state` (not the deprecated `$app/stores`, which throws in SSR — migrate
  pages off it), the synchronous `mock_t` translator helper, mocking store-valued page data
  (`entries_data`), CSV entry-shape crash traps, and tween-screenshot timing.
- [browser-deep-flow.md](./browser-deep-flow.md) — the puppeteer-core deep-flow harness
  (`site/e2e/achi-flow.mjs` + `db-ops-flow.mjs`): why puppeteer-core over Playwright, server
  options (self-boot `node build` vs `BASE_URL=:3041` — media/admin need dev mode), real-auth
  OTP login + the `seed:achi-fixture` requirement, the headless-eval gotchas (locale, ambient
  PORT, innerText-vs-textContent), and the DB-write sync-timing gotchas (auto-sync, WAL-read
  polling, tombstone pull-resurrection, net-zero/self-heal).
