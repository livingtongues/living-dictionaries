# SvelteKit audits (3 parallel agents)

Three **report-only** audit agents (no code changes). Each reads the `svelte` skill + live
SvelteKit docs, investigates, and writes a findings + recommendations report into `.issues/`.

## Context distilled from the house WEB-reader session (the model Jacob wants)

The house Bible reader nailed the isomorphic-loading model Jacob wants applied to LD entry pages:

- A `+*.server.ts` (server) load that **references a changing `params`/`url` value re-runs on every
  matching nav**, and because a *server* load can't run on the client, SvelteKit fetches the route's
  `__data.json` from the server → the `?x-sveltekit-invalidated=…` ping. So "warm client = no server
  pings" requires **no server load at that route level**.
- Fix pattern: move server-only work behind a `+server.ts` **endpoint**; use a **universal**
  `+page.ts`/`+layout.ts` that calls the endpoint **only during SSR + the cold window**, and reads
  warm client caches (wa-sqlite local DB / module singletons) otherwise.
- SSR cost is unchanged: a *relative* `fetch()` in a server-side `load` calls the endpoint handler
  **directly (no real HTTP round-trip)**, and during hydration the response is read from the HTML
  (no client refetch).
- House URL to learn from: `http://localhost:5000/WEB/MAT/11` (isomorphic chapter load). House repo
  files of interest: `site/src/routes/api/chapter/+server.ts`,
  `site/src/routes/[version]/[bookId]/[reference]/+layout.ts`, `site/src/lib/chapter/*`,
  `site/src/lib/db/client/reader-db.svelte.ts` (`synced` flag).

## LD current state (recon already done)

- Entry page `src/routes/[dictionaryId]/entry/[entryId]/+page.ts` is **universal-only** (no
  `+page.server.ts`). Its SSR branch returns a `"Loading..."` placeholder; real entry content is
  hydrated client-side from the browser wa-sqlite `dict.db`. Code comment: *"A server-SQLite SSR read
  for SEO can be a follow-up."*
- `[dictionaryId]/+layout.server.ts` reads `params.dictionaryId` → re-runs/pings on dictionary
  change, but NOT on entry→entry nav within a dict.
- `/og/+server.ts` renders `OpenGraphImage.svelte` → PNG; `SeoMetaTags.svelte` builds og/twitter
  meta and points og:image at `/og?props=…`. Both are wired into the entry page but fed the
  `"Loading..."` placeholder at SSR → generic logo + "Loading…" title for shared links. **OG
  generator is effectively dormant for entries.**
- 17 files use `$effect`.

## Agents

- [x] ✅ **Agent 1 — `$effect`→`$derived` audit** → `.issues/audit-effect-usage.md`
- [x] ✅ **Agent 2 — entry-page SSR + warm-client deep-dive (+ OG shareability)** → `.issues/audit-entry-ssr.md`
- [x] ✅ **Agent 3 — site-wide load/server-ping architecture sweep** → `.issues/audit-load-architecture.md`

## Status

Spawned (living-dictionaries project sessions):
- Agent 1 — `$effect`: `b1cfd35b-1fee-4365-91ef-03f459520945`
- Agent 2 — entry SSR: `6a05e84c-21d4-41db-9667-312d2d24d2b4`
- Agent 3 — load arch: `38cdb2a8-30e8-456c-8dae-0a4ef5d0afd5`
