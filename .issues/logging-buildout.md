# Logging buildout — emission + server logs + dashboard panels

Spun off 2026-06-26 from the first `log-and-fix` review (`.cron/log-reviews/2026-06-25.md`). The
review found the pipeline healthy but blind: 4 core analytics events defined-but-never-emitted, 0/48
API routes logging server-side, and a dashboard that can't tell "broken" from "no traffic." Jacob:
"go crazy on logging, you drive this." Porting validated ideas from house's parallel buildout
(`~/code/house/.issues/analytics-dashboard-and-log-parsing-buildout.md`).

## Plan

### Part 1 — Client analytics event emission ✅
- [x] `[dictionaryId]/+layout.svelte` → `DICTIONARY_OPENED` onMount (once per dict open)
- [x] `entry/[entryId]/+page.svelte` → `ENTRY_OPENED` on entry id
- [x] `entries/+page.svelte` → `SEARCH_PERFORMED` (debounced settled query) + `track_timing({name:'search'})`
- [x] `entries/components/Audio.svelte` → `AUDIO_PLAYED` in initAudio

### Part 2 — Server-side logging (`log_server_event`) ✅
Highest-value failure paths first: auth (verify/send-code/google), sync (changes), uploads
(upload/gcs_serving_url), dictionaries/create, roles, email-inbound.

### Part 3 — remote-log heartbeat throttle while hidden ✅
Port house Thread 3: skip heartbeat tick while `visibilityState==='hidden'`, resume on visible.
Client-only file (not the byte-identical worker harness). Volume win + keeps heartbeat = "alive+visible".

### Part 4 — Dashboard panels (Phase C) ✅
- [x] Errors by build version (current vs stale) — port from house
- [x] Pipeline-health / ingestion-liveness strip (last log, last session_start, retention, archive)
- [x] Self-instrumentation coverage row (vocab seen vs never-emitted)
- [x] Leader-worker health panel (live_query_timeout/recovered/failed + had_leader split)
- [x] Geo-transform hint (located but no coords → CF transform off)

### Part 5 — Verify ✅ pnpm test / check / lint + svelte-look analytics story
### Part 6 — Commit + push
### Part 7 — Live E2E on new.livingdictionaries.app (viewer + editor + create dict) → read logs back

### Part 7 — Live E2E findings (the logging paid off immediately)
Headless puppeteer (`site/tools/e2e/logging-smoke.mjs`, OTP read from VPS shared.db) exercised the
live subdomain as admin + anonymous. Server logs (`auth_login`, `dictionary_created`) + the new
dashboard shape confirmed deployed. Then it surfaced bugs:

- ✅ **CRITICAL (pre-existing, fixed): better-sqlite3 leaked into the client bundle** → every
  dictionary open crashed with minified `i is not a function` (`[dictionaryId]` layout chunk). Root
  cause: `dict-live-db.svelte.ts` / `dict-sync-engine.ts` / `dict-writes.ts` (client) VALUE-imported
  `DICT_SYNCABLE_TABLES` from `$lib/db/server/dictionary-sync-helpers`, which pulls better-sqlite3 via
  the history-capture chain. Nobody hit it because the new VPS had 0 dictionaries until this test.
  FIX: moved the constant to client-safe `$lib/db/dict-syncable-tables.ts`; verified the built client
  bundle has 0 chunks containing `cppdb`/native `bindings`.
- ✅ **gloss_languages.join crash in the new-dictionary email** — create passed the raw row (JSON
  strings) to the email composer (expects arrays). FIX: `parse_row` before `send_dictionary_emails`.
- ✅ **Logging gap: layout load failures shipped as bare "Internal Error" (empty stack)** — added
  `console.error(err)` in the `[dictionaryId]/+layout.ts` catch so the real stack reaches telemetry.
- ✅ **Pre-init analytics race** — child-layout `track()` fired before root `init_remote_logging`;
  `push()` now buffers pre-init events and replays them on init (deep-link landings keep their first
  `dictionary_opened`).

### Final verification (live, post-fixes)
Confirmed in prod `client_logs` after re-running the smoke: `dictionary_opened` (14×),
`search_performed` (4×), server `auth_login` + `dictionary_created`, **zero errors/crashes**; dict
opens cleanly for editor + anonymous; dashboard `event_coverage` live-shows 2/4 events seen; built
client bundle has **0** chunks with `cppdb`/native bindings.

### ✅ RESOLVED 2026-06-26: editor entry WRITE + `/changes` push verified — and a cutover blocker fixed
The "Keyman blocks the main thread" theory was WRONG. Probing each CDP step showed the hang fires
only on submit, because `insert_entry`'s `catch` `alert()`'d a thrown write error and the unhandled
dialog blocked puppeteer. `d.message()` surfaced the real bug: `create_dict_live_db`'s Proxy `get`
trap used the proxy as the `Reflect.get` receiver, so the `get writes()` getter's `this.#writes`
private-field brand check threw → **every `.writes` op (entries, sentences, media, junctions) was
broken on the new stack**. Fixed (`Reflect.get(target, prop, target)`, commit `b21c6894`) + regression
test. Verified end-to-end headless on local dev AND the live subdomain (entry lands in the server
per-dict DB; `entry_opened` + server `dict_changes_pushed` fire). Full write-up:
`.issues/entry-write-proxy-bug.md`; corrected gotcha in `.knowledge/testing/browser-deep-flow.md`.

## Notes / learnings
- track signature: `track({ event, props })`; `track_timing({ name, duration_ms, context? })`;
  `log_event({ level, message, context })`; server: `log_server_event({ level, message, error?, context })`.
- live_query_* events already wired in `dict-live-db.svelte.ts` (source:'dict').
- Container is `sveltekit_blue` (blue/green), DB at `/data/shared.db` readonly.
- ~~prod-db.md is STALE (says container `sveltekit` + `/workspace/site/.data/...`).~~ ✅ RESOLVED
  2026-06-26: prod-db.md folded into the **database** skill (correct `/data/shared.db` +
  `sveltekit_blue` blue/green container), command deleted. See
  `.issues/check-logs-skill-and-prod-db-fold.md`.
