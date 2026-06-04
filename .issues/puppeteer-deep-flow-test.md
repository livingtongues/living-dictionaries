# Puppeteer-core deep-flow E2E test (standardize off Playwright)

## Why
Interactive CDP poking (browser-tools skill) to verify the achi editor flow took ~15-20 agent
turns with guessed `sleep`s. A single scripted automation does login→navigate→N interactions→
assertions→screenshots in **one** run, with real waits, and leaves a re-runnable regression.
Standardize on **puppeteer-core + system Chrome** (matches svelte-look + browser-tools; zero binary
downloads — Jacob's slow internet) instead of Playwright (downloads a browser per version).

## Decisions (Jacob, this session)
- **Self-boot:** script spawns `node build` on a port, waits for "Listening on…", runs, tears down.
  `BASE_URL` env override → skip booting, use that.
- **Launch own headless Chrome** via `puppeteer-core` + `chrome-launcher` `getChromePath()`
  (svelte-look pattern) — isolated from Jacob's open tabs (the shared :9222 instance caused a
  wrong-tab screenshot during the manual test).
- **Fully remove Playwright:** delete `@playwright/test`, `playwright.config.ts`, `e2e/*.spec.ts`,
  and the playwright `package.json` scripts. Replace with the puppeteer script.
- Learn from svelte-look as much as possible.

## svelte-look reference (the pattern to mirror)
`~/code/svelte-look/src/screenshot/puppeteer.ts`:
```js
const puppeteer = (await import('puppeteer-core')).default
const { getChromePath } = await import('chrome-launcher')
browser = await puppeteer.launch({ executablePath: getChromePath(), headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox'] })
```
Versions: `puppeteer-core ^24.9.0`, `chrome-launcher ^1.1.2`. `"type":"module"` (LD site is too).

## Plan / steps
- [x] **Deps:** `pnpm add -D puppeteer-core chrome-launcher --filter=site` (resolved
      `puppeteer-core@24.43.1`, `chrome-launcher@1.2.1`); `pnpm remove @playwright/test --filter=site`.
      Lockfile diff = exactly that (playwright + playwright-core out; puppeteer-core + chrome-launcher
      + transitives in). Incidental dedup: `picomatch 4.0.2→4.0.4` on svelte-check (harmless patch).
- [x] **Remove Playwright files:** deleted `site/playwright.config.ts`, `site/e2e/basic.spec.ts`,
      `site/e2e/kitbook.spec.ts`. Rewrote `site/e2e/E2E.md` (puppeteer guidance). Removed
      `test:e2e`/`test:components`/`test:components:update` scripts; added `test:flow`.
- [x] **Script:** `site/e2e/achi-flow.mjs` ✅ PASSES all 5 steps (entries list → open entry →
      edit phonetic → add sense → delete sense), self-boots `node build`, screenshots each step.
      - If `BASE_URL` set → use it; else: ensure `build/index.js` exists (run build if missing),
        spawn `node build` with `PORT`, await "Listening on" on stdout.
      - Launch puppeteer-core (svelte-look pattern). New page.
      - Flow + assertions (manager mock = can_edit):
        1. goto `/achi/entries`; wait for entry links; assert 13 entries (e.g. "1-13 / 13").
        2. click entry `e_ja`; wait for `/achi/entry/e_ja` overlay (lexeme "jaʼ").
        3. click Phonetic field → wait input value "haʔ"; set via native value setter + dispatch
           input/change; click Save; assert detail shows `[haʔ-EDITED]`.
        4. Add Sense → assert "Sense 2" appears.
        5. Delete Sense 2 (✕) → assert back to 1 sense.
      - Screenshot at key steps → `site/e2e/screenshots/` (gitignore? small — keep dir, ignore PNGs).
      - `finally`: close page/browser, kill server child. Exit 0 on pass, nonzero + clear log on fail.
- [x] **Verify:** `pnpm -F site test:flow` → PASS (5/5). `pnpm -F site check` → 0 errors / 484 warn.
      `pnpm -F site test --run` → 123 pass. `eslint` on the script → clean.
- [ ] **Note (out of scope):** `.github/workflows/component-tests.yml` uses playwright kitbook —
      already stale (kitbook removed in M2b). Flag for separate CI cleanup.

## Gotchas DISCOVERED while building (bake into future scripts)
- **Headless Chrome defaulted to a non-English locale (zh).** The app picks locale from the
  `accept-language` header → UI rendered in Chinese → English text assertions failed. Fix:
  `page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })` + `--lang=en-US` launch arg.
- **Ambient `PORT` leaks in.** The shell had `PORT=3001` set; `process.env.PORT || default` picked it
  up (and 3001 was occupied). Use a dedicated `FLOW_PORT` var so the script's port is independent.
- **`innerText` vs `textContent` matters for assertions.** The eslint `unicorn` rule pushed me to
  `textContent`, which preserves source whitespace — "1-13 / 13" is split across spans/newlines, so
  `textContent.includes('1-13 / 13')` FAILS while `innerText` (rendered, normalized) matches. Use
  `innerText` for visible-text assertions; disable that rule for the file.
- The flow itself confirms the M2b stub write-mutation + worker optimistic updates round-trip
  (phonetic edit, add/delete sense all reflect in the UI).

## Gotchas carried from the manual test (bake into the script)
- Svelte input editing: `input.value=x` won't trip reactivity → use
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,x)` + dispatch
  `input`+`change`.
- Phonetic field opens an IPA-keyboard EditFieldModal; the editable `<input type=text>` holds "haʔ".
- "Sense N" labels only render when an entry has >1 sense (1 sense → no label).
- Manager mock already logged in (no auth step needed now; storageState pattern is for M4+).
- Don't start `node build` unless `build/` exists; CDN `load_cache` may run but manager path
  overwrites with dummy data so it doesn't matter.
