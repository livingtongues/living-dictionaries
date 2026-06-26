# /admin/analytics — dashboard improvement backlog

Deduped backlog of proposals from the `log-and-fix` daily review (Phase C). Read-and-recommend only —
nothing here is built until picked up. Reader: `src/lib/db/server/log-analytics.ts`; page:
`src/routes/admin/analytics/+page.svelte`; chart lib: `$lib/charts/` (Bar/Combo/Line).

## Open proposals

### 1. Pipeline-health / ingestion-liveness strip (prioritize)
A small strip at the top of the page showing:
- `last log received_at` (absolute + relative "Xh ago")
- `last session_start received_at`
- `retention last ran` (from `db_metadata.log_retention_ran_at`)
- archive (`logs-archive.db`) row count

**Why:** with all metrics at zero an operator cannot distinguish "pipeline broken" from "no traffic
yet." This converts the wall-of-zeros into a definitive verdict. Surfaced 2026-06-25 when the whole
review hinged on resolving exactly this ambiguity.

### 2. Self-instrumentation coverage row
List the `$lib/debug/log-events.ts` event vocab and flag each as **seen** (≥1 row ever) vs **never
emitted**. Would have instantly surfaced the 2026-06-25 finding that `search_performed`,
`dictionary_opened`, `entry_opened`, `audio_played` are all defined but wired up nowhere.

### 3. Geo-transform health hint
When `located_sessions > 0` but every `latitude` is NULL, render an explicit "Cloudflare visitor
location-headers transform appears OFF" warning rather than the generic "No coordinates yet" — the
distance-to-Boston TTFB RUM panel silently can't populate without that CF managed transform.

## Sourced from
- `.cron/log-reviews/2026-06-25.md` (first run / zero-data baseline)
