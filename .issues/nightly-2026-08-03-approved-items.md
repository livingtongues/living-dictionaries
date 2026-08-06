# Approved items from the 2026-08-03 nightly fleet reports — DONE, uncommitted

Sources: `.cron/log-reviews/2026-08-03.md` (LD), `~/code/horse/.cron/parity-reviews/2026-08-03.md`,
`~/code/horse/.cron/nightly-reviews/2026-08-03.md`.

**Everything is UNCOMMITTED — Jacob owns all commits.** The tree also holds other agents' work:
19 locale seed files (fill-translations), parity-sweep's map-wrapper typing changes, the running
corpus backfill's `.issues/audio-playback-derivative.md`, `.cron/*`, and
`.claude/commands/log-and-fix.md`. None of those were touched.

Green: `pnpm check` 0 errors · `npx tsc --noEmit` clean · `eslint --quiet site/src site/scripts
site/svelte.config.js` clean · `vitest` 2582 passed / 345 files · `pnpm build` exit 0.

---

## 1. Build version stamp (approved item 2) ✅

`site/svelte.config.js` had no `kit.version.name`, so SvelteKit defaulted it to
`Date.now().toString()` (`@sveltejs/kit@2.63.0`, `src/core/config/options.js:321`) — the defect that
blanked poly.education for nine hours.

**Ladder (`resolve_version_name`):** non-empty `GIT_SHA` → `git rev-parse HEAD` →
`NODE_ENV === 'production'` **throws** → otherwise a memoized `local-<ts>` for dev tools only.

**The plan said "no clock fallback at all, just throw". That broke svelte-look**, which loads the
config with a sanitized PATH that has no git — every component screenshot in the repo failed. The
`NODE_ENV` rung is the fix; `vite build` sets `NODE_ENV=production` for itself before loading the
config, svelte-look loads it as `development`. Measured, not assumed.

**A `globalThis` memo is NOT sufficient for a build here — measured.** A probe showed `vite build`
loads the config **four times** and mints **three different memos**, all reporting the *same*
`process.pid`: SvelteKit runs `postbuild/analyse.js` and `postbuild/prerender.js` in worker threads,
which share a pid but not `globalThis`. `process.env` does survive, which is why `GIT_SHA` and
`NODE_ENV` work.

**Dockerfile:** `ARG GIT_SHA=""` + `ENV GIT_SHA=$GIT_SHA` in the BUILDER stage, placed **after**
`pnpm install --frozen-lockfile` so the cached dependency layer (with its from-source better-sqlite3
compile) isn't invalidated per deploy.

**No vps-setup change needed — verified on the live box:** `/opt/hosting/sveltekit/deploy.sh` on
living exports `GIT_SHA` before `docker compose build`, and its `docker-compose.yml` passes
`args: GIT_SHA: ${GIT_SHA:-}`.

Both container-shaped paths exercised against a real build (git removed from PATH):

| Scenario | Result |
|---|---|
| `GIT_SHA=""` + no git + `NODE_ENV=production` | **refuses to build**, exit 1, message names the fix ✅ |
| `GIT_SHA=<sha>` + no git | builds; one stamp; `version.json` = that sha ✅ |
| normal `pnpm build` | one stamp = `djb2(git HEAD)` ✅ |
| svelte-look (no git, `NODE_ENV=development`) | renders ✅ |

**Downstream of `app_version` no longer being a timestamp** (would have silently broken):
`log-analytics.ts` now dates a build by `deploys[].first_seen` when the version isn't a parseable
epoch — otherwise every non-current build fell into the "unknown age" bucket and the build-adoption
panel would have quietly stopped saying anything. `short_version` shortens a 40-hex sha to the
leading 7 (git's convention). Test expectations updated to match.

## 2. Post-build version check (approved item 13) ✅

`site/scripts/check-build-version.mjs`, wired as `"build": "vite build && node
scripts/check-build-version.mjs"`. Requires ONE stamp across the client chunks
(`__sveltekit_<hash>`), the server bundle (`version_hash: "…"`) and `djb2(version.json)`.

Gotcha found by writing it: `build/server/index.js` legitimately contains
`` `__sveltekit_${options.version_hash}` `` and a literal `globalThis.__sveltekit_sw` (the
service-worker env endpoint). The first version failed a perfectly good build on those; the server
side is read via `version_hash:` instead.

Both failure shapes proven by injecting them into a real build: a second `__sveltekit_` name → exit
1 naming both files; a hand-edited `version.json` → exit 1 naming both stamps.

## 3. Audio sweep demoted (approved item 5, rescoped by Jacob) ✅

Conversion-on-upload stays THE path. The sweep is now a **once-daily backfill in a forked
`nice 19` / `ionice 3` child**, cron `days(1)` at 04:10 PT (after the 03:30 maintenance child).

- `audio-derivative-backfill.ts` — the job + the child entry (`AUDIO_DERIVATIVE_CHILD=1`), exports
  `BACKFILL_MODULE_URL`.
- `audio-derivative-sweep.ts` — parent: forks, owns every ledger write, emits telemetry.

**The trap that made this two files:** written as one file, rollup folded the job into the **hooks
chunk** (crons.ts → hooks.server.ts), whose module body calls `start_crons_once()` — forking it
would have started a second cron scheduler in every child. A **dynamic** `import()` is what forces
its own chunk; verified against the built output (`grep -rl AUDIO_DERIVATIVE_CHILD build/server` →
one dedicated 11 KB chunk importing only dictionary-db / media-path / audio-derivative).

**The scan itself is fixed too, not just relocated:** the computed-key `LEFT JOIN` (unindexable →
full scan) is now two plain scans diffed in JS, and dictionary DBs are opened **once per dictionary**
instead of once per candidate row (was up to 160 sync file opens per run).

`audio_derivative_sweep_completed` carries **`blocking_ms`** (parent event-loop time = the fork call
+ one indexed ledger upsert per derivative), plus `duration_ms`, `scanned`, `candidates`,
`generated`, `failed`, `truncated`, `step_ms{ledger_scan,dict_lookups,convert}`, `convert_ms
{p50,p90}`, `bytes_out`, first 5 `errors`. `warn` above 250 ms blocking or any failure.

Verified: forked the **real production chunk** with a scratch `DATA_DIR` — reports over IPC, exits 0,
no cron scheduler, no migrations; all-derivatives-present → 0 candidates; missing derivative and a
timings-edited clip → both detected. Plus `audio-derivative-backfill.test.ts`: a real ffmpeg encode
end-to-end proving exactly the right two clips convert and the timings-carrying one stays UNTRIMMED
(its word offsets would otherwise slide).

Caps: `MAX_PER_RUN` 2000, `MAX_RUN_MS` 60 min, child SIGKILL at 90 min, ffmpeg concurrency 2.

`r2-media.ts` now falls back to `process.env` — `$env/dynamic/private` is empty in a forked chunk.

## 4. Upload errors + iPhone HEIC (approved item 9, expanded) ✅

**(a)** `send_xhr` surfaces the server's own message (JSON `{message}` first, short plain text next,
markup refused) via a new `UploadError`. `UploadImageStatus.svelte` already renders `err.message`, so
Vincent's *"This HEIC photo could not be converted…"* now actually reaches the person.

**(b)** `media_upload_failed` carries a capped `server_message` **separate** from the client's
`error_message` — the two used to be the same string, so telemetry couldn't tell a rejected format
from a dead network.

**(c)** Real HEIC support via `heic-to` (libheif wasm), `import()`ed only after the file's leading
64 bytes sniff as HEIC (`is_heic_bytes`, catching a HEIC named `.jpg`) **and** the free native
`createImageBitmap` rung has failed — so Safari and every JPEG upload download zero bytes of it.
Plus `shrink_to_fit`: HEIC is ~2× denser than JPEG, so a legal HEIC can transcode past the 10 MB
endpoint ceiling; quality then a 2400px longest edge. New `heic_converted` / `heic_conversion_failed`
events.

Proven in headless Chrome against a **real** HEVC-coded HEIC (generated with pillow-heif):
native `createImageBitmap` → `InvalidStateError` (Vincent's exact failure); the wasm decoder → a
valid 640×480 `image/jpeg` in 1.9 s, zero page errors.

**Decoder chunk, from a real production build:** raw 2,996,512 · **brotli 490,423** · gzip 730,048.
One referencing chunk, from inside the `import()`; `grep -rl <chunk> build/server` empty, so SSR
never preloads it. *Cheaper option not taken:* `libheif-js`'s separate `.wasm` is **286 KB brotli
(-41%)** because `heic-to` inlines its wasm as base64, but it needs a non-ESM emscripten glue +
`?url` asset wired through Vite by hand and loses Live-Photo/multi-image handling. See
`.knowledge/domain/heic-photo-uploads.md`.

## 5. Sign-in panel (approved item 11) ✅ — alarm REMOVED 2026-08-05

- `sign_in` added to the analytics payload (`build_sign_in_health`), computed in the daily niced
  child from the existing `auth_login` `{method, created}` events. `SNAPSHOT_FORMAT` bumped 1 → 2.
- `/admin/health` **Sign-in** panel — `SignInPanel.svelte` + stories, screenshotted light + dark.

The zero-logins alarm that originally shipped with this (a cron posting into the admin chat
`notifications` room) was **removed at Jacob's request on 2026-08-05** — he does not want login
notifications. Only the plain logins-per-method panel remains. See
`.issues/remove-sign-in-alarm.md`; do not rebuild the alarm.

---

## Notes for Jacob before/after committing

- **`SNAPSHOT_FORMAT` 1 → 2** means `/admin/analytics` + `/admin/health` show the "no checkpoint yet"
  state until the boot-catchup child recomputes (~3 min after the container boots). Expected, not a
  fault.
- `heic-to` was added to `site/package.json` dependencies → `pnpm-lock.yaml` is modified.
- The corpus audio backfill running on mustang (`~/ld-audio`, horse cron `c-223e77`) is untouched;
  this change only alters what the *app* does from now on.
