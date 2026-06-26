---
description: Daily read-and-recommend client_logs review for Living Dictionaries. Reads all client/server logs from the VPS shared.db, triages errors, paints the usage/perf/geo/health picture, scours the codebase for missing logging, proposes /admin/analytics improvements, and writes a dated report of action-steps. NEVER edits code.
---

# Log Review & Coverage Loop (Living Dictionaries)

LD runs **no** third-party analytics or error tracking — `client_logs` in the VPS `shared.db` is the
*only* window into what users do and what breaks. This command is our "Google Analytics + Sentry
without the cruft": read everything logged, make smart decisions from it, and find where we're flying
blind. You are also my advisor on how to improve this command + our logging.

> **This command NEVER edits code.** Read-only investigation + recommendations. Everything actionable
> becomes an action item in the dated report or a new `.issues/` file — safe to run unattended.
>
> **Deploy target:** the new VPS app serves `new.livingdictionaries.app` from the `svelte-5-migration`
> branch (the apex `livingdictionaries.app` is still the old Vercel app — not this). Review the VPS
> `client_logs`; until heavy real traffic lands on `new.*` the volume is light.

## Three phases, one report

| Phase | What | Output |
|---|---|---|
| **A — Inspect** | Read the logs on the server; triage + summarize (errors / usage / perf+geo / health) | Findings + action items |
| **B — Scour** | Walk the codebase for important paths that *should* log but don't (informed by A) | Prioritized coverage suggestions |
| **C — Sharpen** | Look at `/admin/analytics` with fresh eyes given the now-larger dataset | ≥1 concrete improvement proposal |

All three write into a single dated report: **`.cron/log-reviews/YYYY-MM-DD.md`**, then a short chat
summary. B and C are read-and-recommend — they propose, they don't build.

## Default scope

- **Window:** last **24h**, all levels — but always render **7-day** and **30-day** trend context.
- **Filter `build_target='production'`** to drop local/preview test noise where it helps.
- **Overridable** by the invocation ("last 7 days", "only errors", a `user_id`). Honor it.

## Background — how logs get here

`site/src/lib/debug/remote-log.ts` (init'd once from `+layout.svelte` `onMount`) hooks `window.error`
/ `unhandledrejection`, patches `console.error`, emits heartbeats (30s) + `session_start` (carries
`db_tier` + `db_caps` capability telemetry) + `visibility_*`, and exposes `log_event()` / `track()` /
`track_timing()` / `track_web_vital()` / `log_navigation()`. Buffered in
`localStorage.debug_log_pending`, flushed every 5s via `POST /api/log` and on `pagehide` via
`sendBeacon`. Server `insert_client_log()` writes to `shared.db.client_logs`, stamping `source` +
approximate Cloudflare geo. The forever `log_daily_metrics(day, metric, source, value)` rollup +
`/admin/analytics` (admin-gated, `log-analytics.ts`) give the aggregate picture. `client_logs` is
excluded from `SYNCABLE_TABLE_NAMES` (server-only; clients never read it back).

Key columns: `received_at` (server ISO, indexed DESC — ORDER BY this), `client_time`, `level`
(`error|warn|info|unhandled_rejection|crash`), `message`/`stack` (clamped 2k/16k), `url`,
`user_agent`, `platform`, `app_version`, `build_target`, `source` (`client|server`; NULL legacy =
client), `user_id` (nullable), `country`/`region`/`city`/`latitude`/`longitude` (CF geo),
`context` (JSON: `session_id`, `breadcrumbs[]`, `db_tier`, per-event extras). Analytics events store
the stable event name (`log-events.ts`: `search_performed`, `dictionary_opened`, `entry_opened`,
`audio_played`) as `message` on an `info` row.

## Querying prod — SSH + `docker exec`, read-only

`sqlite3` is NOT on the VPS host. Query through the primary **`sveltekit_blue`** container via
`better-sqlite3` (the VPS runs blue/green since 2026-06-24 — no plain `sveltekit` container; `_green`
is the standby sharing the same `/data` mount, fine for read-only queries too).

- **Container DB path: `/data/shared.db`** (`DATA_DIR=/data`). Always open `{ readonly: true }`.
- **Escaping:** write the query to a local temp `.js` and pipe it through stdin:

```bash
cat > /tmp/lq.js <<'EOF'
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
const since = new Date(Date.now() - 24*60*60*1000).toISOString()
// ...query...
console.log(JSON.stringify(rows, null, 2))
EOF
ssh living 'docker exec -i sveltekit_blue node' < /tmp/lq.js
```

(See the **database** skill's production-VPS section for the canonical pattern + safety rules,
`debug-vps.md` for server/deploy issues.)

---

## Phase A — Inspect the logs

### A1. Errors & crashes

**Cluster** so one user hitting an error 50× is one row. Group by `message` + first 200 chars of `stack`:

```js
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
const since = new Date(Date.now() - 24*60*60*1000).toISOString()
const rows = db.prepare(`
  SELECT message, substr(coalesce(stack,''),1,200) stack_head,
         COUNT(*) n, MIN(received_at) first_seen, MAX(received_at) last_seen,
         COUNT(DISTINCT user_id) users, COUNT(DISTINCT app_version) versions
  FROM client_logs
  WHERE received_at >= ? AND level IN ('error','unhandled_rejection','crash')
  GROUP BY message, stack_head ORDER BY n DESC, last_seen DESC
`).all(since)
console.log(JSON.stringify(rows, null, 2))
```

**Drill** a cluster — pull the most recent full instance, then replay the session by
`json_extract(context,'$.session_id')` ORDER BY received_at to reconstruct breadcrumbs + routes.
**Investigate** in the codebase (grep the message + symbols). **Recommend a fix — do NOT apply it.**

**Severity rubric:** 🔴 P1 = `crash` / many distinct users / blocks a core flow (dictionary/entry/
search/audio/auth). 🟠 P2 = recurring `error`, single feature, has a workaround. 🟡 P3 = low-freq /
one user / cosmetic. ⚪ noise = expected/3rd-party/transient — name it so it filters next run.

### A2. Usage & engagement

The GA half. Distinct sessions & users (24h/7d/30d), median & p90 session duration (span of
heartbeats per `session_id`), top routes (`message='navigation'`, `json_extract(context,'$.to')` →
the `dictionaries`/`about`/`account`/… buckets), top analytics events (`search_performed`,
`dictionary_opened`, `entry_opened`, `audio_played`), platform/version split. Call out surprises.

### A3. Performance & geography

- **Perf:** where `message='perf'` (carries `context.name` + `context.duration_ms`, plus web vitals
  under `context.name='web_vital'`), summarize p50/p90/p95 by `name` (`page_load`, `search`) vs the
  7/30-day trend. Page-load TTFB rides in `context.ttfb`.
- **Geo:** top areas by sessions (`country`/`region`), and **TTFB by distance to the Boston origin**
  (haversine of `latitude`/`longitude` → distance). This is the geo-split RUM — call out if
  far-region users pay a large TTFB tax (distance from Boston ≈ TTFB; LD is Boston-hosted like house).
- **Capability:** `session_start.context.db_tier` distribution (`opfs-worker` / `idb-worker` /
  `idb-main`) + any below-capability (Safari < 15.4) sessions that can't run the leader-worker DB.

### A4. Health & housekeeping

Total rows, daily volume + growth, oldest `received_at` vs **retention status** (the cron always runs
on the active node — verify `db_metadata.log_retention_ran_at` is recent and oldest row ≤14d), DB
size, heartbeat/noise ratio.

---

## Phase B — Scour the codebase for missing logging

Informed by Phase A: where did a user clearly do something or hit something we *couldn't see*?
Recommend (don't add) the event/level/fields each should emit.

**Inventory:** client user-flows (dictionary browse, entry edit, search, audio, account,
create-dictionary), every `src/routes/api/*/+server.ts` failure path (auth/OTP, admin-sync,
messages/email-inbound, uploads), background jobs (R2 snapshot cron), the sync engine (push/pull
failures, conflict resolution), and server-side gaps that today only hit ephemeral `docker logs`
(convert to `log_server_event`). For each: **path → event name → level → fields → why it's worth it
(or why it's noise).** Prioritize by "would this have answered a question we couldn't answer in A?".

**Emission convention (use this shape):** `track({ event, props })` for analytics (event from the
`$lib/debug/log-events.ts` vocab), `log_event({ level, message, context })` for handled warnings/
errors, `track_timing({ name, duration_ms })` for slow ops, `log_server_event({ level, message,
error?, context })` server-side (`source='server'`). `console.error` stays patched; `console.warn`/
`info`/`log` stay DEV-ONLY.

---

## Phase C — Sharpen the dashboard

`/admin/analytics` (admin-gated, `log-analytics.ts`) turns the logs into decisions — usage / perf /
geo / health from `log_daily_metrics` + live `client_logs`, merged hot+cold per day. It should get
**more useful every week** as data accumulates — that only happens if someone keeps pushing it.
**Each run, study it and propose ≥1 concrete improvement** (never "looks fine"); write the idea into
the report + append to a deduped backlog **`.issues/future/dashboard-improvements.md`** (create if
missing). Build nothing. Lenses: what did I compute by hand here that the page should just show? what
trend is legible now that wasn't? what's noisy/misleading? Spot-check a headline number vs your raw
query — drift means a bug to file. The reusable chart lib is `$lib/charts/` (Bar/Combo/Line).

---

## Output

1. **Write `.cron/log-reviews/YYYY-MM-DD.md`** (create the folder if missing):

```markdown
# Log review — YYYY-MM-DD (new.livingdictionaries.app · window: last 24h)

## TL;DR
- <3-5 bullets: health verdict, top issue, top opportunity>

## 1. Errors & crashes
<clusters by severity, each with root-cause hypothesis + action item>

## 2. Usage & engagement
<sessions/users 24h·7d·30d, durations, top routes/events, surprises>

## 3. Performance & geography
<timings where logged; geo areas + TTFB-by-distance; capability mix; slow-path gaps for Phase B>

## 4. Health & housekeeping
<volume, growth, db size, retention status, noise>

## 5. Coverage gaps (Phase B)
<prioritized: path → event → level → fields → why>

## 6. Dashboard improvements (Phase C)
<≥1 concrete proposal for /admin/analytics; link the backlog items you'd prioritize>

## Recommendations / action items
- [ ] <each as a checkbox; link new .issues/ files>

## Trend context (7d / 30d)
<daily counts table or sparkline data>
```

2. **Chat summary** — TL;DR + the single most important action, and confirm the report path.

## Related

- **database** skill (`.claude/skills/database/SKILL.md`) — canonical SSH + `docker exec` DB pattern + safety rules
- `debug-vps.md` — server/Caddy/deploy/env issues
- **check-logs** skill (`.claude/skills/check-logs/SKILL.md`) — the error-only triage flow (Phase A1 alone) + the `client_logs` pipeline/schema reference
