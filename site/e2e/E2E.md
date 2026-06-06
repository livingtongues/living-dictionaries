# E2E / deep-flow testing — puppeteer-core + system Chrome

We drive a real browser with **puppeteer-core** pointed at the **already-installed Chrome**
(`chrome-launcher`'s `getChromePath()`), so there's **no per-version browser download** — the same
engine `svelte-look` and the `browser-tools` skill use. (Playwright was removed for this reason.)

## Run

```bash
pnpm -F site build            # produce build/ once (the script will auto-build if missing)
pnpm -F site test:flow        # boots its own `node build`, runs the flow, tears down
```

Point at an already-running server (skips booting):

```bash
BASE_URL=http://localhost:3041 pnpm -F site test:flow
PORT=3097 pnpm -F site test:flow            # change the self-booted server's port (default 3095)
```

Exit code is non-zero on any failed assertion. Screenshots land in `e2e/screenshots/` (git-ignored).

## What `achi-flow.mjs` covers
A logged-in **mock manager** (`can_edit`) exercises the full editor: entries list (13 entries) →
open an entry overlay → edit the phonetic field via its EditFieldModal → add a sense → delete that
sense → assert the original survives. Since M4 the 13 achi entries are read from `achi.db`
(seeded by `pnpm -F site seed:achi-fixture`); edits still ride the stub (write = M4-write).

## M4 SQLite-read flows
- `test:catalog` (`catalog-sqlite.mjs`) — the dictionary catalog reads from `shared.db`: API
  public/private counts, the `/dictionaries` list, dict detail resolution, unknown-slug redirect.
- `test:entries` (`entries-sqlite.mjs`, `DICT=torwali`) — the Orama worker is fed from the per-dict
  SQLite db via `/api/dictionaries/[id]/entries-data`; asserts the real torwali corpus renders.
- `review-shots.mjs` (`node e2e/review-shots.mjs`) — quick visual pass: screenshots `/`,
  `/dictionaries`, `/<dict>/entries`, `/<dict>/about` into `e2e/review/` (git-ignored) for eyeballing.
- Both SQLite flows **filter known-external console errors** (Mapbox tile 403s in headless, the
  entries-worker CDN-cache 403) so the pageerror assertion reflects the conversion, not ambient noise.
- Needs `site/.data` seeded (shared.db + per-dict dbs from the example; `VACUUM INTO` for clean copies).

## Authoring more flows — the workflow
1. **Explore** with the `browser-tools` skill (interactive CDP on `:9222`) to discover selectors.
2. **Codify** the deep/repeatable path here as a puppeteer-core script with real `waitForFunction`
   waits + assertions, so it becomes a one-command regression instead of many agent turns.

### Gotchas baked into the script (reuse them)
- **Svelte-bound inputs:** `input.value = x` won't trip reactivity. Use the native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, x)`) then
  dispatch `input` + `change`.
- Prefer `page.waitForFunction(() => document.body.innerText.includes(…))` over fixed sleeps.
- The dev server (`:3041`) is usually Jacob's already-running `pnpm dev` (you may start it if not);
  point `BASE_URL` at it, or boot your own `node build` (this script does) for an isolated agent run.
  Note: media-upload + the `dev_admin_level` toggle are DEV-gated, so they only work against `pnpm dev`.
- At M4+ (real auth), log in once and reuse puppeteer's `storageState` / cookies to start deep.
