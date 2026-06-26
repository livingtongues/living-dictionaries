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

## Notes / learnings
- track signature: `track({ event, props })`; `track_timing({ name, duration_ms, context? })`;
  `log_event({ level, message, context })`; server: `log_server_event({ level, message, error?, context })`.
- live_query_* events already wired in `dict-live-db.svelte.ts` (source:'dict').
- Container is `sveltekit_blue` (blue/green), DB at `/data/shared.db` readonly.
- prod-db.md is STALE (says container `sveltekit` + `/workspace/site/.data/...`).
