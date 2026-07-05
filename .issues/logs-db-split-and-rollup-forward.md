# logs.db split + rollup-forward analytics (LD parity port)

Full parity port of house's finished, verified implementation
(`~/code/house/.issues/logs-db-split-and-rollup-forward.md`), adapted to LD's shape.
LD started from the OLD pre-optimization stack: raw `client_logs` in shared.db, no
`session_id` column (json_extract everywhere), no watermark, no `log_daily_sessions`,
no bot-sessions.ts, no temp-set audience filter, no analytics cache.

## Reference (house — the pattern)
- `logs-db.ts` (code-created logs.db + slice indexes + `split_client_logs_from_shared`)
- `log-retention-cron.ts` (full-day-REPLACE rollup, real_errors, log_daily_sessions,
  watermark, reroll_archived_days_once)
- `log-analytics.ts` (3-tier reader, merged window sessions, 15-min cache, fresh pipeline)
- `bot-sessions.ts`, `classify-error.ts`, `schemas/logs.ts`, hooks boot split
- knowledge: house `.knowledge/architecture/client-logs.md` "Rollup gotchas" section

## LD-specific shape (KEEP these; house lacks them)
error_clusters, missing_i18n_keys, boot_health, api_v1, deploys, server_faults(stack-head
drift), uptime, leader_health(LD variant). LD LACKS (do NOT add): reading_by_book,
content_performance, server_render, version_markers, reader_404s. LD has ONE analytics page
(`/admin/analytics`), not house's usage/health split — keep single `get_log_analytics`.

## Real-data findings (2026-07-05, prod probe)
- 86,903 client_logs rows / 7d. One spoofed Safari-17.4 UA produced 117 zero-heartbeat
  anon sessions/day; **411 of 1481 sessions (28%) reclassify as bots** by the UA-freq rule
  → bot-sessions.ts IS warranted (port it).
- Local dev shared.db: 5,278 rows over 10 days (2026-06-26..07-05); baseline runs against it.

## Plan / checklist
1. ✅ BASELINE FIRST: captured current-code get_log_analytics JSON on a copy of local
   shared.db (5278 rows/10d), frozen now 2026-07-05T12Z, 7/30 × humans/bots.
2. ✅ session_id real column: migration `20260705_client_logs_session_id` (ALTER+backfill) +
   ingest stamp (insert-client-log) + archive retrofit (pragma check ALTER).
3. ✅ logs.db split: new logs-db.ts (schema+6 slice indexes+split), boot split in
   hooks.server.ts, VACUUM, inserts default → logs.db, archive reads logs.db.
   R2 note: per-dict snapshot builder never touches shared.db/logs.db → excluded automatically.
4. ✅ bot-sessions.ts (verbatim from house) + temp-set audience filter replacing is_bot_ua UDF.
   Prod data confirmed the crawler pattern (28% of sessions reclassify).
5. ✅ rollup-forward: watermark + full-day REPLACE + real_errors + log_daily_sessions
   (migration `20260705a`) + slice indexes + 3-tier reader + 15-min cache + fresh pipeline.
   All 3 gotchas handled (ghost-metric DELETE, `lq_source` alias fix, plain level index).
6. ✅ Docs/skills: check-logs, database, sqlite-query skills, log-and-fix command (ATTACH for
   the cross-file users join), AGENTS.md (Telemetry bullet), build-graph system tables +
   inline test, shared.ts (session_id + log_daily_sessions). No LD logs CLI exists to port.
7. ✅ VERIFICATION COMPLETE:
   - Equivalence: BEFORE(old reader) vs AFTER(new, all-live) byte-identical except the new
     `webdriver_sessions` field. AFTER all-live vs AFTER rollup-forward (watermark 2026-07-04,
     466 sessions materialized, 10 real_errors metrics): identical except `retention_ran_at`
     (liveness) + ordering ties among equal-count 404 events in the top_events tail — the
     accepted divergences.
   - Full suite 1285 pass (new: split idempotence/crash, watermark advance + no-double-count,
     session materialization, ghost-metric purge, reroll-once, UA-freq crawler, session_id
     stamp). tsc 0, eslint 0, svelte-check 0 errors.
   - Prod build boots on real .data copy: split moved 5278 rows, shared.db 11.8→6.95MB,
     healthz 200. Live /api/admin/analytics: 200, cold 70ms / cached 2.9ms / bots 47ms,
     webdriver_sessions=450, leader_health split fixed, pipeline.hot_rows=5721.

## ✅ STATUS: SHIPPED — committed (b5bce3e8) + pushed + deployed to prod 2026-07-05.

### Prod post-deploy verification (2026-07-05)
- healthz 200. Deploy live on `main` @ b5bce3e8.
- **logs.db**: 89,394 client_logs rows, ingest fresh (latest 12:35Z), session_id populated
  on 54,274 rows (rest = server rows / legacy w/o session context — expected). 193M.
- **shared.db**: client_logs table GONE (split ran + VACUUM), down to 12M. Rollups present:
  log_daily_metrics 2262, log_daily_sessions 1567 (materialized). logs-archive.db 4K (nothing
  aged yet — expected).
- **No server errors/warns in 3h post-deploy.** Client errors are baseline noise only
  (initial dict sync, stale-chunk dynamic-import from cached old builds) — nothing from this change.

## Deliberate bug fixes (documented)
- **leader_health GROUP BY shadow**: `... AS source ... GROUP BY source` bound to the real
  client_logs.source COLUMN, collapsing the admin/viewer/dict split. Fixed with `lq_source`
  alias (same class house hit). Snapshot updated: failed_by_source now splits viewer+dict.
- **ghost metrics**: rollup_day now full-day DELETEs before insert (was upsert-only).

## Accepted equivalence divergences (document each)
±1 session at classification boundaries (multi-UA / midnight-spanning — rollup is day-local),
ordering ties among equal counts, deliberate bug fixes (ghost-metric purge).

## Constraints
Tree has uncommitted work elsewhere — DO NOT touch/revert. NEVER commit or branch. pnpm,
snake_case, options objects.
