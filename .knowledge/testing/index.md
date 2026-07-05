# Testing knowledge

Durable conventions/gotchas for verifying LD beyond what the code shows.

## Pages
- [svelte-look-page-stories.md](./svelte-look-page-stories.md) — writing `_page.stories.ts`:
  svelte-look mocks `$app/state` (not the deprecated `$app/stores`, which throws in SSR — migrate
  pages off it), the synchronous `mock_t` translator helper, mocking store-valued page data
  (`entries_data`), CSV entry-shape crash traps, tween-screenshot timing, and the layout-story
  constraint (all props fold into `data`, so `children` snippets can't be passed — use
  `{@render children?.()}`).
- **Streamed server loads can't be verified in dev** — Vite dev buffers `__data.json`, so
  client-nav to a `stream()`-ed `+page.server.ts` (dict home/contributors/invite; see
  `$lib/state/stream-resolve.svelte.ts`) feels blocking in dev. Verify with a prod build
  (`pnpm build` + `JWT_SECRET=<any> PORT=… DATA_DIR=$PWD/.data node build`) + puppeteer
  CDP network throttling. Full pattern write-up: house
  `.knowledge/architecture/admin-streaming-snappy-nav.md`.
- [browser-deep-flow.md](./browser-deep-flow.md) — the puppeteer-core deep-flow harness
  (`site/e2e/achi-flow.mjs` + `db-ops-flow.mjs`): why puppeteer-core over Playwright, server
  options (self-boot `node build` vs `BASE_URL=:3041` — media/admin need dev mode), real-auth
  OTP login + the `seed:achi-fixture` requirement, the headless-eval gotchas (locale, ambient
  PORT, innerText-vs-textContent), and the DB-write sync-timing gotchas (auto-sync, WAL-read
  polling, tombstone pull-resurrection, net-zero/self-heal).
