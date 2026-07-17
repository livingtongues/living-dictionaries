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

## Server: self-boot OR point at the running dev server
- `curl` from the Bash tool can't reach the dev server, **but the `browser-tools` headless Chrome
  CAN** — so `BASE_URL=http://localhost:3041 pnpm -F site test:flow` runs against the (usually
  already-running) `pnpm dev`. You may also start the dev server yourself if it isn't up.
- With no `BASE_URL`, the script boots its **own** `PORT=<FLOW_PORT> node build` (waits for the
  `Listening on` stdout line, then `SIGTERM`s it). **Caveat:** dev-only features are compiled out of
  `node build` — the **dev-media mock** and the **`dev_admin_level`** cookie only work against
  `pnpm dev`. So media / admin-impersonation flows must use `BASE_URL=:3041`.

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

## Real auth (M4+) — login + the seed
Auth is real now. The flows log in **in-page** via the dev inline-OTP path: `POST
/api/auth/email/send-code` returns the code (dev / `E2E_EXPOSE_OTP=true`), then
`/api/auth/email/verify` sets the session cookie in the browser jar. They log in as the seeded
**non-admin** `achi-manager@example.com`, so `can_edit` resolves from a real `dictionary_roles` row.

- **The seed is required:** `pnpm -F site seed:achi-fixture` (`scripts/seed-achi-fixture.ts`) inserts
  that user + a manager role into `shared.db`. It's **self-contained** (the old mock content
  reseed was retired). The achi **content** fixture (`e_*` entries, all stamped `MOCK_USER_ID`) lives
  in `.data/dictionaries/achi.db`.
- **Pulling the full prod catalog into `shared.db` CLOBBERS achi's roles** with the real
  livingtongues managers (annaluisa@ — who is an **admin** — and diego@), dropping the test
  manager. Re-run the seed. `db-ops-flow.mjs` runs it automatically at startup.

## `db-ops-flow.mjs` (`pnpm -F site test:db`) — the DB-write regression
Covers the per-dict write path against the **real** SQLite: DictLiveDb audit auto-stamping (the
`create_dict_live_db({ user_id })` enabler), `operations.ts`/`dbOperations` over `$app/state`, the
phonetic mutate-then-`_save()` pilot, and a sync round-trip to `.data/dictionaries/achi.db`. It
drives the actual store in-page via `globalThis.__ld_dict_connections.<dict>.{connection,dict_db}`
(query / execute / sync_now / table methods) and reads the server file with `better-sqlite3`.

### Sync-timing gotchas that bit (reuse them)
1. **The dict sync engine AUTO-SYNCS.** Don't assert "rows are `dirty` before my explicit
   `syncNow`" — auto-sync may have already pushed+cleared them. Assert `dirty===1` *immediately*
   after each write instead, and **poll** the server file for persistence (eventually consistent)
   rather than assuming one `syncNow` + one read.
2. **Direct WAL file reads are eventually consistent.** A fresh readonly `better-sqlite3` open right
   after a push sometimes misses the just-committed row — poll with a short backoff.
3. **Deletes are HARD now (tombstone + FK cascade) — and the app USES `.delete()`.** As of the
   hard-delete conversion (issue complete + deleted 2026-06-11), `.delete()`/`_delete()`
   `INSERT INTO deletes` → trigger `DELETE`s the row + FK-cascades children. The server trigger truly
   `DELETE`s, so the old "pull-resurrection on snapshot" fear is GONE (the snapshot is taken from a DB
   where the row is already gone). For deterministic net-zero test cleanup of created rows, still purge
   the server file FIRST (so a concurrent auto-sync pull can't re-add) then delete locally — but this is
   now belt-and-braces, not fighting a soft/hard mismatch.
4. **Net-zero or self-heal.** A mid-run crash after auto-sync leaves a test row in the server
   `achi.db` (entry count drifts off 13). `db-ops-flow.mjs` purges `ZZ-test*` leftovers from the
   server file at startup.
5. **`achi-flow.mjs` is net-zero (fixed 2026-06-06b).** It edits `e_ja.phonetic` to `haʔ-EDITED`,
   asserts persistence, then restores it to `haʔ` (mutate-then-save the live row + poll the server file
   until the sync lands). The phonetic-edit step is value-agnostic (targets the visible modal input, not
   the literal `haʔ`) so it's idempotent even if a prior crashed run left the field edited.
6. **`dict-sync.mjs` (`test:sync`) is NOT net-zero** — it leaves `e_ja.phonetic = haʔ-SYNC-…` behind
   (restore to `haʔ` manually after running). Its output also block-buffers (no incremental logs until
   exit) — don't assume it's hung.

## Dev-server / fixture gotchas (livedb-scalar-field-migration, 2026-06-06b)
- **OTP `send-code` rate limit is DISABLED in dev + e2e** (`expose_otp = dev || E2E_EXPOSE_OTP`) — the
  10/email/hour cap is a production abuse guard only, so heavy automated/manual login loops never 429.
  (Historically it bit us: hammering one email 400'd `verify` because `send-code` stopped returning the
  inline `code`. If you ever see that against a real prod server, that's the cap working as intended.)
- **Vite dev cold-start / HMR can `net::ERR_ABORTED` the first `page.goto` to a route.** Dep
  optimization (or an HMR full reload right after you edit a route's module) aborts the in-flight
  navigation. Not an app bug. `db-ops-flow.mjs` wraps `goto` in a retry-on-`ERR_ABORTED` helper; reuse
  that pattern in any new puppeteer script (only needed against the **dev** server, not `node build`).
- **Restoring a damaged achi fixture.** If achi.db loses rows (e.g. a stray hard-delete during
  delete-flow smoke testing — `e_ja` got tombstoned once, dropping achi to 12 entries), rebuild it from
  the set-aside `.data/dictionaries.old-soft-delete-schema/achi.db` using the per-file copy logic in
  `scripts/migrate-dict-dbs-hard-delete.mjs` (stop the dev server first — better-sqlite3 holds the file
  open; then restart). That backup is the only source for the achi fixture (it's not in git).

## Exercising the LIVE subdomain + reading telemetry back (log-and-fix loop)
`site/tools/e2e/*.mjs` (eslint-ignored via `site/tools/**`) drive `new.livingdictionaries.app`
with headless puppeteer-core to generate real `client_logs` telemetry, then we read it back from
the VPS `shared.db`. Patterns that work:
- **Admin login headless in PROD** (send-code does NOT return the OTP inline outside dev): POST
  `/api/auth/email/send-code` from the page, then read the freshest code straight from the VPS DB
  via `execFileSync('ssh',['living','docker exec -i sveltekit_blue node'],{input: <better-sqlite3 query on email_codes>})`, then POST `/api/auth/email/verify` → sets the httpOnly cookie in the jar.
- **Verify a deploy is live** before asserting behavior: poll `/_app/version.json` until the
  `version` flips, and/or `ssh living 'git -C /opt/hosting/sveltekit/code rev-parse --short HEAD'`.
  Confirm a server change shipped by GETting `/api/admin/analytics` and checking the new field shape.
- **Read telemetry back**: query `logs.db.client_logs` (raw logs split out of shared.db 2026-07-05; rollups stay in shared.db) grouped by `message` to confirm events
  fired (e.g. `dictionary_opened`, `search_performed`, server `auth_login`/`dictionary_created`),
  and per-dict DBs at `/data/dictionaries/<id>.db` for entry writes.

### The entry-add WRITE path DOES verify headless — the "hang" was an `alert()`, not Keyman
An earlier note here blamed the **Keyman** keyboard for blocking the page main thread on entry-add.
That was wrong. The real chain (diagnosed 2026-06-26 by probing each CDP step with a short
`protocolTimeout`): opening the modal and setting the lexeme value are both fine; the hang triggers
**only on clicking submit**, because `operations.ts insert_entry`'s `catch` calls **`alert(err)`**,
and an **unhandled native dialog blocks the page indefinitely under puppeteer** (every subsequent
`page.evaluate` then dies with `Runtime.callFunctionOn timed out`). It looks like a main-thread
freeze but isn't — screenshots (compositor path) still render; only main-thread RPC blocks.

- **ALWAYS register `page.on('dialog', d => { capture d.message(); d.dismiss() })`** in any flow that
  can hit an editor error path — and **`d.message()` hands you the actual error text**. That's how
  the underlying bug was caught: `TypeError: Cannot read private member #writes …`.
- **Underlying bug (fixed):** `create_dict_live_db` wraps the instance in a `Proxy` whose `get` trap
  did `Reflect.get(target, prop, receiver)` with the **proxy** as receiver, so the `get writes()`
  getter's `this.#writes` private-field brand check threw → EVERY `.writes` op (insert_entry,
  sentences, media, junctions) failed. Fix: resolve with `target` as the receiver. Regression test:
  `dict-live-db-proxy.test.ts`.
- With the dialog handler in place, the editor write verifies fine **headless** on local dev AND the
  live subdomain: modal save → OPFS write → `/changes` push → server `/data/dictionaries/<id>.db`
  row, with `entry_opened` + server `dict_changes_pushed` telemetry. See
  `site/tools/e2e/local-create-entry.mjs` and `subdomain-create-entry.mjs`.
- **Set the value, don't type it:** `save()` reads `inputEl.value` directly, so set it via the native
  setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v)`) +
  dispatch `input`, then click `form button[type="submit"]`. The entries **search box also uses
  `class="form-input"`** and is first in the DOM, so scope the modal input as `form input.form-input`
  (the search box isn't in a `<form>`).
- **Headful-under-Xvfb is available** if ever needed (`apt install xvfb`; `xvfb-run -a -s "-screen 0
  1280x900x24" node script.mjs` with `launch({ headless: false })`), but it's slower and **WebGL
  fails** without a GPU (the home-globe page errors; entries pages are fine). Headless + a dialog
  handler is the better path — reach for headful only for input pipelines headless genuinely can't
  drive.

## Whole-app visual-parity screenshots (`e2e/uno-parity-shots.mjs`)
`site/e2e/uno-parity-shots.mjs` screenshots ~23 main routes against the dev server (:3041). Despite
the `uno-` name it's the **kept harness for ANY whole-app visual refactor** — the dark-mode flip, the
svelte-ui restyle, etc.: `node e2e/uno-parity-shots.mjs <out_dir> [name-prefix,…]`, diff with
`compare -metric AE -fuzz 2% baseline/x.png after/x.png diff/x.png`. Sources of false diffs (learned in
the 2026-06-12 uno drop):
- **Restarting the dev server subtly shifts text antialiasing across the whole page** (fuzz-2% diffs
  everywhere) — capture baseline AND "after" against the **same** running server instance; if a route
  you didn't touch also drifts, it's AA ghosting, not your change.
- **`pnpm check` runs `svelte-kit sync`, which triggers a full-reload storm that hangs concurrent
  puppeteer `goto`s** — never run a check and the screenshot sweep in parallel.
- **Block `googleusercontent.com`** (avatars intermittently `ERR_BLOCKED_BY_ORB`) for determinism.
- **Mapbox tiles / YouTube + Vimeo embeds / firebase images flake** — eyeball those regions; the pixel
  diff there is noise.
- **Select e2e elements by semantic class / aria-label, never by icon class** — the old `i-*` selectors
  broke the instant icons were swapped; use `.add-sense-button` / `.delete-sense-button` etc.

## Role-gated flows: don't log in as an admin (it masks the path)
`jwrunner7@gmail.com` — the email the existing harnesses authenticate as — is a **LEVEL-2 site
admin** (`$lib/admins.ts`). In `[dictionaryId]/+layout.ts`, `is_site_admin` short-circuits `role` to
`'admin'`, so a site admin always has `can_edit=true` regardless of `dictionary_roles`. To genuinely
test a **dictionary-role** path (manager/editor/contributor gating), log in as a **fresh
`@example.com` user** — not in the allow-list, so its `can_edit` hinges entirely on the real grant.
Dev sign-up is open: `POST /api/auth/email/send-code` returns the OTP inline, `…/verify` creates the
user. Example: `site/tools/e2e/create-dict-soft-nav.mjs` (the create-dictionary soft-`goto`
regression) uses a fresh user to prove a brand-new NON-admin manager can immediately edit.

## Detecting soft (client-side `goto`) vs hard (full reload) navigation
Two reliable signals captured before the nav and re-read after: (1) set a `window.__probe` value —
it **survives a soft nav, is wiped by a hard reload**; (2) `page.evaluateOnNewDocument(() =>
window.__doc_loads = (window.__doc_loads||0)+1)` increments per real document load — **unchanged**
across a soft nav, **+1** on a hard reload. Puppeteer's `framenavigated` fires for BOTH, so it can't
distinguish them — use the probe + doc-load counter instead.
