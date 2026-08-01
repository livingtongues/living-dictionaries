# Durable monthly metrics + monthly admin-chat summary

Approved by Jacob 2026-08-01, following the full-July audience baseline
(`.issues/full-july-audience-baseline.md`). That run proved the numbers exist but live only in a
markdown file, and that **the raw data behind them expires** — `ARCHIVE_WINDOW_DAYS = 60`, so July 8's
raw `client_logs` prune around **2026-09-06**. July is the pre-surge starting line; if it isn't
persisted before then it is unrecoverable.

> Jacob: *"We've been making a lot of changes to the analytics search… and improvements to the API…
> I'd really like to start this month before the big changes really have benefit. If we lost this
> month it would be a little bit tragic — we'd lose the starting point for our big surge."*

## Decisions (Jacob, 2026-08-01)

1. **Q1 = A.** Durable monthly-metrics table FIRST, freeze July now. Charts later, report after.
2. **Q2 = D.** The monthly "report" is a **post into the admin chat `notifications` room** — a few
   simple, easy-to-parse lines of basic stats. **Percentage change starts next month** (nothing to
   compare against yet). **No link to an analytics chart yet** — "a chart with one data point's kind
   of boring." Charts get built + linked once there are ≥2 months.
3. **Q3 = A.** Public homepage visitors stat is DEFERRED. Plan: pull from the per-month data and
   divide to whatever period reads best (day/week/month). **Revisit after THREE complete months** —
   July counts as one, so after August and September close (≈2026-10-01).
4. **Metric definition (Jacob's reframe):** the standing production metric is **agent vs
   hand-entered**, NOT insider vs curator — *"users come to us admins, so even if we do imports, it's
   on their behalf."* Measurable exactly: `changes.api_key_id` in `dictionaries/{id}.history.db`
   (non-NULL = agent via `/api/v1`, NULL = a human typing in the UI).
5. **Extrapolation is allowed FORWARD only.** Never manufacture the pre-07-08 days. Normalize the
   measured window up to a 31-day run-rate using the measured new-visitor arrival rate.

## Why a run-rate and not a month total

Unique visitors are a UNION — a returning device adds nothing — so they cannot be scaled linearly.
The July clean window shows the **new-visitor arrival rate is FLAT** (216/day over 24 days; 219 last-14;
213 last-7; no decay), because LD's audience is dominated by first-time search arrivals rather than a
saturating pool. That is the condition that makes a short forward extension honest.

**Normalization (derived on read, never stored pre-cooked):**
`normalized_visitors = site_visitors + max(0, 31 - days_counted) * new_visitor_rate`

For any complete month `days_counted = 31` (or 28/30 — see below) and the normalization is a **no-op**.
Only July needs it. July 1–2 was never captured at all (apex moved onto this stack at the 07-03
cutover), so a literal July total is unknowable and must never be asserted.

_Month-length note: normalize to a fixed 31 so months are comparable to each other; a 30-day month
measures 30 days and gets one day added. This is a deliberate "per standard month" convention._

## Design

### 1. `monthly_metrics` table (shared.db, server-only, forever, never pruned)
One row per month. Records **what was actually measured over an explicitly-recorded window**, so the
honesty lives in the data rather than in a comment. Freezes like `dictionary_monthly_visitors`.

Key columns: `month` PK · `window_start`/`window_end`/`days_counted` · site visitors/visits/anon ·
`new_visitor_rate` · mission + fenced visitor unions · corpus stock (public + platform) · corpus flow
(mission created / agent / hand, fenced created) · `computed_at` · `announced_at`.

Constants: `FIRST_METRICS_MONTH = '2026-07'` (first device-keyed month — never look further back),
`VISITOR_ID_STABLE_FROM = '2026-07-08'` (window start floor), `NORMALIZED_MONTH_DAYS = 31`.

### 2. Computation runs in the EXISTING niced analytics child
The compute scans a month of raw `client_logs` plus every dictionary's entries + history db. That is
far too heavy for the serving process — standing law from the 2026-07-29 Living 503: *nothing from
analytics may ever slow, bog down or block the machine.*

**Reuse `analytics-snapshot.ts`'s child rather than building new fork plumbing.** It already forks once
a day at nice 19 from the retention cron's `after_sweep`, and the sweep runs `rollup_recent_months`
(which freezes the prior month) BEFORE forking — so on the 1st the child sees a frozen month. The child
gains one job: compute any missing month `>= FIRST_METRICS_MONTH` and `< current month`, and write its
row. It opens a writable shared.db handle for that single small INSERT (the only write it does).

### 3. The monthly announcement posts from the SERVER process
Pings need SES/ntfy, which only exist in the SvelteKit runtime, so the child cannot post. After
`spawn_analytics_snapshot_job` resolves in `after_sweep`, the parent checks for a `monthly_metrics` row
with `announced_at IS NULL` and posts it via `deliver_system_message` into `ROOM_NOTIFICATIONS`, then
stamps `announced_at`. Idempotent by that stamp.

Post shape — a few parseable lines, % change only when a prior row exists:
```
📊 July 2026 — Living Dictionaries
Visitors: ~6,700/month · 97% not signed in
Mission dictionaries: 92% of readers
Entries added: 28,652 — 93% by agent, 7% by hand
Public corpus: 221 dictionaries · 273,581 entries
```

## Steps
- ✅ Migration `20260801_monthly_metrics.sql`
- ✅ `$lib/db/server/monthly-metrics.ts` — compute + read/normalize helpers
- ✅ Wire compute into the analytics child (`freeze_monthly_metrics`, its only write)
- ✅ `$lib/db/server/monthly-metrics-announce.ts` + wired into `after_sweep` in `crons.ts`
- ✅ Tests — 23 passing (`monthly-metrics.test.ts` + inline suite in the announce module)
- ✅ Full verification: **2,512 tests pass**, `tsc` clean, `lint` clean, `svelte-check` 0 errors
- ✅ AGENTS.md telemetry bullet updated
- [ ] **Jacob to commit + push** (deploy) — NOT done, per standing rule
- [ ] Verify July's row after the first post-deploy 03:30 PT sweep (see below)
- [ ] Charts on /admin/analytics — deferred until ≥2 months exist (Sept 1)
- [ ] Public homepage stat — revisit after 3 complete months (≈2026-10-01)

## Uncommitted-tree warning
The LD working tree ALSO contains an unrelated concurrent lane's work
(`.issues/nightly-fixes-2026-08-01.md`: `hooks.client.ts`, `+error.svelte`, `og/*`,
`notification-digest-cron.ts`, `.knowledge/server/sveltekit-error-hooks.md`, and its own edit to the
same AGENTS.md telemetry bullet). **This work's files are:**
`site/src/lib/db/schemas/shared-migrations/20260801_monthly_metrics.sql`,
`site/src/lib/db/server/monthly-metrics.ts`, `…/monthly-metrics-announce.ts`,
`…/monthly-metrics.test.ts`, `…/analytics-snapshot.ts`, `…/crons.ts`, plus the AGENTS.md sentence
beginning "**`monthly_metrics` (2026-08-01)**" and this issue file.

## Post-deploy verification
The backfill is automatic: `missing_metric_months` returns `['2026-07']` while no row exists, and the
analytics child runs from the retention sweep at **03:30 PT daily**. Boot catch-up only fires when a
snapshot is missing or >30 h old, so after a same-day deploy the row lands at the NEXT sweep (03:30 PT
the following morning), not immediately. Verify with:

```sh
ssh living 'docker exec -i sveltekit_blue node' <<'JS'
const d = new (require('better-sqlite3'))('/data/shared.db', { readonly: true })
console.log(d.prepare('SELECT * FROM monthly_metrics').all())
JS
```

The 2026-07 row must match the validated targets below. Then check the `notifications` chat room for
the posted summary (it should read `~6,693/month · 97% not signed in`, `92% of readers`,
`28,652 — 93% by agent, 7% by hand`, `221 dictionaries · 273,581 entries`, plus the capture note).

## Validated July targets (the row must reproduce these)
Site window 2026-07-08 → 07-31, 24 days: **5,182** visitors · 12,320 visits · 5,012 anon (97%) ·
new-rate **216/day** → normalized **≈6,694**. Mission: 4,048 · 8,761 · 3,940, rate 169 → ≈5,231.
Fenced: 365. Corpus stock: public 221 / 273,581; platform 1,296 / 590,091. Flow: mission created
28,652 (agent 26,553 / hand 1,932 / unattributed 167); fenced 1,407.

## Deadline
Must be deployed and July backfilled before **~2026-09-06** (when 07-08 raw prunes). Large margin, but
this is the one hard date in the plan.
