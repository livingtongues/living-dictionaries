# Browser deep-flow E2E — puppeteer-core harness

`site/e2e/achi-flow.mjs` (run via `pnpm -F site test:flow`) drives a real browser through the achi
editor end-to-end. Read the script + `site/e2e/E2E.md` for the how; this page records the *why* and
the non-obvious gotchas.

## Why puppeteer-core (not Playwright)
Playwright downloads its own browser binary per version (bad on slow internet). **puppeteer-core +
`chrome-launcher`'s `getChromePath()`** reuses the **already-installed Chrome** — zero downloads,
and it's the same engine `svelte-look` and the universal `browser-tools` skill already use. We
removed `@playwright/test` + `playwright.config.ts` + the old `e2e/*.spec.ts` to standardize.
Launch pattern is copied from `~/code/svelte-look/src/screenshot/puppeteer.ts`.

## Interactive CDP vs scripted — when to use which
- **browser-tools skill (interactive CDP on :9222):** great for *exploring* an unknown DOM; but a
  deep flow becomes ~15-20 agent turns with guessed `sleep`s.
- **puppeteer-core script (this):** one run, real `waitForFunction` waits, assertions, screenshots,
  re-runnable. The intended workflow: *explore with browser-tools to find selectors → codify the
  deep path here.*

## Self-booting (no dev server)
The dev server (`:3041`) is Jacob's and isn't sandbox-reachable. The script boots its **own**
`PORT=<FLOW_PORT> node build` (prod build IS reachable), waits for the `Listening on` stdout line,
runs, then `SIGTERM`s it. `BASE_URL` env skips booting and points at any running server.

## Gotchas that bit while building this (reuse them)
1. **Headless Chrome locale defaults to non-English (saw `zh`).** The app picks locale from the
   `accept-language` header, so the UI rendered in Chinese and English text assertions failed. Fix:
   `page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })` + `--lang=en-US` launch arg.
2. **Ambient `PORT` leaks into the script.** A dev shell had `PORT=3001`; `process.env.PORT || x`
   inherited it (and 3001 was busy). Use a **dedicated** `FLOW_PORT` so the chosen port is isolated.
3. **`innerText` ≠ `textContent` for assertions.** `textContent` preserves source whitespace, so a
   visually-contiguous string like `1-13 / 13` (rendered from separate spans) is split by newlines
   and `textContent.includes('1-13 / 13')` FAILS. Use **`innerText`** (rendered, whitespace-
   normalized) for visible-text matches. The eslint `unicorn/prefer-dom-node-text-content` rule
   pushes the wrong way here — it's disabled in the script for that reason.
4. **Svelte-bound inputs ignore `input.value = x`.** Set via the native setter
   (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, x)`) then
   dispatch `input` + `change`, or Svelte won't see the change.

## What the flow proves about the M2b stub
Editing the phonetic field, adding a sense, and deleting a sense all reflect in the UI — confirming
the stub-client's in-memory write mutation + the search worker's optimistic updates round-trip.

## Future: auth
Auth is currently stubbed to a mock manager, so no login step is needed. At M4+ (real auth), log in
once and reuse cookies / puppeteer `storageState` to start tests deep without re-authenticating.
