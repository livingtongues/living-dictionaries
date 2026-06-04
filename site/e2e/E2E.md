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
The M2b mock seeds dummy achi entries + a logged-in **mock manager** (`can_edit`), so the script
exercises the full editor: entries list (13 entries) → open an entry overlay → edit the phonetic
field via its EditFieldModal → add a sense → delete that sense → assert the original survives.

## Authoring more flows — the workflow
1. **Explore** with the `browser-tools` skill (interactive CDP on `:9222`) to discover selectors.
2. **Codify** the deep/repeatable path here as a puppeteer-core script with real `waitForFunction`
   waits + assertions, so it becomes a one-command regression instead of many agent turns.

### Gotchas baked into the script (reuse them)
- **Svelte-bound inputs:** `input.value = x` won't trip reactivity. Use the native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, x)`) then
  dispatch `input` + `change`.
- Prefer `page.waitForFunction(() => document.body.innerText.includes(…))` over fixed sleeps.
- The dev server (`:3041`) is Jacob's — boot your own `node build` (this script does) for agent runs.
- At M4+ (real auth), log in once and reuse puppeteer's `storageState` / cookies to start deep.
