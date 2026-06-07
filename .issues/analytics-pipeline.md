# Homegrown analytics — one event stream + a daily rollup + admin charts

Build basic, self-hosted web analytics (no Google Analytics) by **extending the existing
`remote-log` → `/api/log` → `client_logs` telemetry pipeline**, then roll the raw events up
into a small aggregate table and chart it on a new `/admin/analytics` page.

Goal metrics: **country, device, OS, browser, screen size, pages visited, time on
site/page, sessions, unique visitors** — plus errors stay colocated in the same stream so we
can see what a user did right before a crash.

> Decided with Jacob (this thread): roll our own (we're ~80% there already); **one row stream**
> (reuse `client_logs`, add a `pageview` level) so behavior + errors sit together and we just
> flush often; tuck visit stats into an **aggregate table with matching admin charts**;
> **cookieless** identity via a **long-lived (NOT daily-rotated) visitor hash** — GDPR is
> explicitly a non-concern; **prototype in LD first**, then port to tutor & house.
>
> **Resolved follow-ups:** engaged-time = **max heartbeat elapsed per session** (last tick wins);
> **drop bot hits at ingest** (don't insert — so the `is_bot` column below is unnecessary);
> **per-app `ANALYTICS_SALT`** (visitor hashes non-correlatable across LD/tutor/house);
> raw `client_logs` **kept until a manual agent-run flush** (automate ~weekly once the process is
> trusted — so NO pruning code in v1); **rollup trigger = TBD** (discuss later).
> `ADDRESS_HEADER=cf-connecting-ip` already appended to the poly/living/house envs and pushed via
> `bin/sync … --env-only` — **pending a container restart** to take effect (shanding/China excluded).

## Status: PLANNED — nothing built yet. This is the spec.

---

## What already exists (don't rebuild)

| Piece | File | Notes |
|---|---|---|
| Client capture + shipper | `site/src/lib/debug/remote-log.ts` | session_id, 30s heartbeat, breadcrumbs, `sendBeacon` flush on pagehide, localStorage buffer. Emits `session_start`, `heartbeat`, `visibility_*` as `info`. |
| Init | `site/src/routes/+layout.svelte` (`onMount`) + `+error.svelte` | `init_remote_logging()` runs. **`log_navigation` is NOT wired yet** (no `afterNavigate`). |
| Ingest endpoint | `site/src/routes/api/log/+server.ts` | Batch POST, optional auth → `user_id`, per-IP token bucket, batch cap 50. Never throws. |
| Beacon transport | `site/src/routes/api/log/_call.ts` (`api_log`, `send_log_beacon`) | Blob beacon, credentials included → cookie auth travels. |
| Insert + validate | `site/src/lib/server/insert-client-log.ts` | clamps, JSON-stringifies `context`, drops malformed. Has `VALID_LEVELS` set. |
| Table | `client_logs` in `shared.db` (`schemas/shared.ts` + `shared-migrations/20260525_initial.sql`) | **Server-only** — excluded from `SYNCABLE_TABLE_NAMES` (`db/sync/types.ts`). |
| Level type | `ClientLogLevel` in `schemas/shared.types.ts` | `'error' \| 'warn' \| 'info' \| 'unhandled_rejection' \| 'crash'`. |
| Admin shell + nav | `site/src/routes/admin/+layout.svelte` | `nav_links` array; scoped CSS using `var(--…)` theme. No logs/analytics page exists yet. |

Migrations are date-prefixed `.sql` in `shared-migrations/`, glob-imported and applied once
(via a `migrations` table) by **both** the server (`db/server/shared-db.ts`) and the admin
client (`db/client/db.ts`). New tables/columns go in a fresh migration file; server-only
tables are created on clients too but stay empty + out of the syncable set.

---

## ⚠️ Pre-existing bug to fix as part of this (the IP problem)

Behind **Cloudflare → Caddy → node**, SvelteKit's `getClientAddress()` returns the *proxy*
IP because adapter-node's `ADDRESS_HEADER` is unset (`XFF_DEPTH` defaults to 1). Consequences:

- The `/api/log` **rate limiter buckets all clients under one proxy IP** (effectively global).
- We have **no true client IP** for country / visitor hashing.

**Fix:** read the real client IP from Cloudflare's `cf-connecting-ip` header. Cleanest is to
set **`ADDRESS_HEADER=cf-connecting-ip`** in the prod env (origin is only reachable via
Cloudflare, so the header is trustworthy) — this fixes `getClientAddress()` app-wide, including
the existing rate limiter, for free. Keep a header-read fallback in the analytics code in case
the env isn't set. Country comes from **`cf-ipcountry`** (same managed-transform family we just
enabled for `cf-iplatitude/longitude` in `+layout.server.ts`).

> Add `ADDRESS_HEADER=cf-connecting-ip` to `vps-setup/secrets-decrypted/sveltekit-living.env`
> and push via `bin/sync living`. Verify in dev/staging that getClientAddress changes per client.

---

## Data model

### 1. New `pageview` level

Add `'pageview'` to:
- `ClientLogLevel` (`schemas/shared.types.ts`).
- `VALID_LEVELS` set (`insert-client-log.ts`).

`client_logs.level` is a bare `TEXT NOT NULL` (no CHECK constraint — just a comment), so **no
DDL change is needed for the enum value**; the column already accepts it. Keeping errors
"clean" = the `level` column cleanly separates `error`/`crash`/`warn` from `pageview`/`info`,
so the future errors view filters `level IN ('error','warn','unhandled_rejection','crash')`
and the analytics rollup reads `level = 'pageview'`.

### 2. New first-class columns on `client_logs` (additive, nullable)

These are server-stamped at ingest and useful on **every** row (great for error triage too —
"which OS/country is crashing"):

```sql
-- migration: site/src/lib/db/schemas/shared-migrations/<YYYYMMDD>_analytics.sql
ALTER TABLE client_logs ADD COLUMN country      TEXT;     -- cf-ipcountry (e.g. 'US')
ALTER TABLE client_logs ADD COLUMN visitor_hash TEXT;     -- long-lived anon id (see below)
ALTER TABLE client_logs ADD COLUMN session_id   TEXT;     -- promoted out of context for fast GROUP BY
ALTER TABLE client_logs ADD COLUMN device       TEXT;     -- 'mobile' | 'tablet' | 'desktop'
ALTER TABLE client_logs ADD COLUMN os           TEXT;     -- 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | ...
ALTER TABLE client_logs ADD COLUMN browser      TEXT;     -- 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | ...
ALTER TABLE client_logs ADD COLUMN referrer     TEXT;     -- document.referrer host, or '(direct)'
ALTER TABLE client_logs ADD COLUMN is_bot       INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_client_logs_visitor ON client_logs(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_client_logs_session ON client_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_country ON client_logs(country);
```

- Screen size (`{ w, h, dpr }`) stays in `context` JSON — low query value, no column needed.
- Keep the new columns nullable so existing error rows are unaffected.
- Update `insert_client_log` to write them; update the Drizzle `client_logs` schema in
  `schemas/shared.ts` to match (keeps the schema-graph + types honest).

### 3. `visitor_hash` — cookieless, long-lived

Server-side at ingest:

```
visitor_hash = sha256( cf_connecting_ip + '|' + user_agent + '|' + ANALYTICS_SALT )
```

- `ANALYTICS_SALT` is a **stable** env secret (NOT rotated — Jacob's call), so a visitor stays
  the same id across days/sessions. The salt only stops trivial reversal of (ip,ua).
- Tradeoffs (acceptable): same person on phone + laptop = 2 visitors; many users behind one
  NAT with the same UA can collide. Good enough for traffic stats.
- No cookie, no localStorage id → no consent banner needed (and we don't care anyway).

### 4. Aggregate table `analytics_daily` (server-only, shared.db)

Long/tidy format so any dimension charts trivially. Recomputed idempotently per day from raw
`client_logs` (so `COUNT(DISTINCT visitor_hash)` is correct **within** each slice):

```sql
CREATE TABLE IF NOT EXISTS analytics_daily (
  day             TEXT NOT NULL,            -- 'YYYY-MM-DD' (UTC, from received_at)
  dimension       TEXT NOT NULL,            -- 'total' | 'country' | 'device' | 'os' | 'browser' | 'route' | 'referrer'
  value           TEXT NOT NULL,            -- e.g. 'US' | 'mobile' | '/about' | '(direct)'; '' when dimension='total'
  pageviews       INTEGER NOT NULL DEFAULT 0,
  visitors        INTEGER NOT NULL DEFAULT 0,  -- COUNT(DISTINCT visitor_hash) in this slice
  sessions        INTEGER NOT NULL DEFAULT 0,  -- COUNT(DISTINCT session_id) in this slice
  engaged_seconds INTEGER NOT NULL DEFAULT 0,  -- summed per-session engaged time (see below)
  computed_at     TEXT NOT NULL,
  PRIMARY KEY (day, dimension, value)
);
```

Add `analytics_daily` to the **server-only** set (do NOT add to `SYNCABLE_TABLE_NAMES`; it's
created-but-empty on clients like `client_logs`). The admin charts read it via a server
endpoint, not local-first (see "Surfacing").

**Note** uniques don't sum across slices — that's expected. The `dimension='total'` rows are
the headline pageviews/visitors/sessions; the per-dimension rows are breakdowns.

---

## Capture changes (client)

1. **Wire pageviews.** In `+layout.svelte`, add `afterNavigate(({ to, from }) => log_pageview(...))`
   and emit one on initial load too. Repurpose/replace `log_navigation` to push **`level: 'pageview'`**
   with `context: { referrer, screen: { w, h, dpr }, pathname }`. (The existing `log_navigation`
   already computes `elapsed_seconds` + breadcrumb — fold that in.)
2. **Referrer:** `document.referrer` host on first load (`'(direct)'` if empty / same-origin);
   for SPA navs the `from` route.
3. **Screen size:** `window.screen.width/height` + `devicePixelRatio` → into `context.screen`.
4. Keep `session_start` / `heartbeat` / `visibility_*` as-is — they drive **engaged time**.
5. (Optional) drop `FLUSH_INTERVAL_MS` a bit and/or flush on each pageview for "flush often".

> `platform`/`app_version`/`build_target`/`user_agent`/`url` are already captured. We do NOT
> parse UA on the client — the server does it (one source of truth, and works for beacons).

## Enrichment (server, at ingest in `insert-client-log` / `/api/log`)

- `country` ← `cf-ipcountry` header.
- `visitor_hash` ← sha256(cf-connecting-ip + UA + salt).
- `session_id` ← lifted from `payload.context.session_id`.
- `device` / `os` / `browser` ← new `parse-user-agent.ts` util (hand-rolled regex, **zero deps**;
  keep native-dep rules in mind — but this is pure JS so either dep section is fine).
- `is_bot` ← UA regex (`bot|crawl|spider|slurp|headless|curl|wget|python-requests|…`).
- `referrer` ← `payload.context.referrer` (host only), normalized to `'(direct)'`.

Thread `event` (for headers + getClientAddress) from `/api/log/+server.ts` into the insert so
enrichment can read request context. Keep insert pure-testable by passing the derived values in.

## Rollup job

- A small `analytics-rollup.ts` that, for each recent UTC day (e.g. today + yesterday, plus a
  backfill mode): `DELETE FROM analytics_daily WHERE day = ?` then re-INSERT the `total` +
  per-dimension `GROUP BY` aggregates from `client_logs WHERE level='pageview' AND is_bot=0`.
- **Engaged time:** per `session_id` that day, `engaged_seconds = MAX(context.elapsed_seconds)`
  across its heartbeat/visibility/navigation rows; attribute to the session's country/device/etc.
  (Route-level time-on-page is a v2 — needs consecutive-pageview deltas.)
- **Trigger:** in-process `setInterval` sweep (~30 min), gated by an env flag and run on a single
  node — mirror `start_r2_snapshot_builder()` in `hooks.server.ts`. Plus a CLI/backfill entry.
- Idempotent (delete-then-insert per day) so re-runs and late events self-heal.

## Retention / keeping it clean

- Prune raw high-volume rows once rolled up: delete `level IN ('pageview','info')` older than
  ~60–90 days (aggregate preserves the long-term stats). Keep `error`/`warn`/`unhandled_rejection`/
  `crash` longer (~180 days) for debugging. Run in the same sweep.
- `analytics_daily` is tiny — keep forever.

## Surfacing — `/admin/analytics` page + endpoint

Unlike other admin pages (messages/users read **synced** local-first data), `client_logs` and
`analytics_daily` are **server-only**, so the page can't read them from the client's wa-sqlite.
It needs a server endpoint:

- **`GET /api/admin/analytics?range=7d|30d|90d`** — admin-gated (`verify_auth` + AdminLevel
  super-admin check; honor the `dev_admin_level` cookie in dev). Reads `analytics_daily` from
  the server `shared.db`, returns headline totals + per-dimension breakdowns + a daily series.
  Add a `_call.ts` (`$api/admin/analytics`).
- **`/admin/analytics/+page.svelte`** — add `{ href: '/admin/analytics', label: 'Analytics' }`
  to `nav_links`. Render:
  - Headline cards: pageviews, unique visitors, sessions, avg session duration (range-selectable).
  - Line chart: pageviews & visitors over time (from `dimension='total'`).
  - Top-N bar lists: countries, routes, referrers; device & OS splits.
  - A date-range toggle (7/30/90d).
  - Charts as **inline SVG** (no chart lib — matches the app's minimal-deps norm; the chart
    SVGs can follow the small `.map`-driven pattern used elsewhere). Build a tiny
    `BarList.svelte` / `LineChart.svelte` under `lib/components/analytics/` + svelte-look stories
    for screenshot verification.
- (Optional, nice) a separate raw **errors** view later (the `db/sync/types.ts` comment already
  anticipates "admins query via dedicated endpoint") — out of scope here but the same endpoint
  shape applies.

---

## Tasks

- [x] Append `ADDRESS_HEADER=cf-connecting-ip` to poly/living/house envs + `bin/sync … --env-only` (done). **TODO: restart containers** so it loads; then verify `getClientAddress()` per-client. Fixes the `/api/log` rate-limiter bug too.
- [ ] Migration `<date>_analytics.sql`: new `client_logs` columns + indexes + `analytics_daily` table. Bump any "latest migration" test.
- [ ] `ClientLogLevel` + `VALID_LEVELS` += `'pageview'`; update Drizzle `client_logs` schema with new columns.
- [ ] `parse-user-agent.ts` (device/os/browser/is_bot) + tests.
- [ ] Enrich at ingest: country, visitor_hash (sha256 + `ANALYTICS_SALT`), session_id, UA fields, referrer. Thread `event` into the insert.
- [ ] Client: wire `afterNavigate` → `level:'pageview'` with referrer + screen; emit on initial load; (optional) flush-on-pageview.
- [ ] `analytics-rollup.ts` (idempotent daily recompute + engaged-time) + retention prune; periodic trigger in `hooks.server.ts` (env-gated) + CLI backfill.
- [ ] `GET /api/admin/analytics` (+ `_call.ts`), admin-gated.
- [ ] `/admin/analytics/+page.svelte` + nav link + `BarList`/`LineChart` components + svelte-look stories + screenshots.
- [ ] `ANALYTICS_SALT` + `ANALYTICS_ROLLUP_ENABLED` (or reuse the snapshot-builder gate) added to env + canonical secrets.
- [ ] Verify: `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Verification

- Unit: `parse-user-agent` cases; rollup math (pageviews/visitors/sessions/engaged) over a
  seeded `client_logs` set incl. bots (excluded) and multi-session visitors; visitor-hash
  stability across two days with same ip+ua; idempotent re-run of a day.
- Endpoint test (`/api/admin/analytics`): admin-gated, returns expected shape for a seeded day.
- Screenshot: the admin analytics page via svelte-look stories (seeded aggregate data).
- Manual: hit the site in dev, confirm `pageview` rows land with country/device/visitor_hash,
  run the rollup, see numbers on `/admin/analytics`.

## Decisions (resolved)

- ✅ **Engaged-time:** max heartbeat elapsed per session (last heartbeat/visibility tick wins).
- ✅ **Retention:** none in v1 — keep raw `client_logs` until a manual agent-run flush; automate
  (~weekly) later once trusted. So skip the prune task for now.
- ✅ **Bots:** **drop at ingest** (don't insert the row). Makes the `is_bot` column unnecessary
  and removes the `is_bot=0` filter from the rollup.
- ✅ **Salt:** **per-app** `ANALYTICS_SALT`.

## Still open

- **Rollup trigger** (background interval vs on-demand at page load): deferred — discuss later.

## Porting to tutor & house (after LD proves out)

tutor & house already have `client_logs` (shared conventions). The portable pieces: the new
columns + `pageview` level, `parse-user-agent.ts`, the enrichment, `analytics_daily` + rollup,
the `/api/admin/analytics` endpoint, and the chart components. tutor's RN client needs its own
pageview emitter (no `afterNavigate`/`document.referrer`) and its world VPS (poly) gets
`cf-*` headers. The **china VPS (shanding) is the trivial case** — it serves China, one country
and one timezone (UTC+8 / `Asia/Shanghai`), so just **hardcode `country='CN'`** there; no GeoIP
needed. (Real client IP for the visitor hash comes from Caddy's `x-forwarded-for` instead of
`cf-connecting-ip` → set `ADDRESS_HEADER=x-forwarded-for` on shanding.)

## Related

- `site/src/lib/debug/remote-log.ts` / `site/src/routes/api/log/*` — the pipeline being extended.
- `site/src/routes/+layout.server.ts` — already reads `cf-iplatitude/longitude` (same CF header family).
- `.issues/app-group-removal-and-global-theme.md` — admin theme/UnoCSS context for the new page.
- tutor `.issues/user-timezone-sleep-window.md` — sibling use of Cloudflare geo headers.
