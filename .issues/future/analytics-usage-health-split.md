# PB3 — Split /admin/analytics into Usage + Health dashboards

Model: house `3ee7aa2` ("Split admin telemetry into usage and health dashboards").
Deferred from the 2026-07-03 overnight batch as the single largest/riskiest item —
it restructures the ~1050-line live admin dashboard and is architecturally divergent
from house, so it wants Jacob's eyes before/after. The other 10 batch items shipped.

## Why this is bigger in LD than in house
house loads analytics through a `+page.server.ts` (`get_usage_analytics` /
`get_health_analytics`), so its split was: split the builder + add `/admin/health`.

LD loads through an **API endpoint**: `admin/analytics/+page.ts` → `$api/admin/analytics/_call`
→ `GET /api/admin/analytics/+server.ts` → `get_log_analytics(...)`. (LD uses a
universal `+layout.ts`, so the page can't be a `+page.server.ts`.) So the LD split
also needs an endpoint/param story, not just a new route.

## Recommended LD approach (shared builder, lower risk than house's full builder split)
Do NOT split `get_log_analytics` into two builders (house did — but LD just added
`server_faults` (RS1) + `api_v1` (L8) + `stale_errors` (X1) to it with fresh tests;
re-slicing risks that). Instead:

1. **Endpoint** — add a `section` query param to `GET /api/admin/analytics`
   (`'usage' | 'health' | 'all'`, default `'all'` for back-compat). Cheapest: keep
   returning the full `LogAnalytics`; the split is purely which panels each PAGE
   renders. (Optional later: compute only the needed panels per section to save work.)
2. **New route `/admin/health`** — `+page.ts` (mirror `analytics/+page.ts`, gate on
   `auth_user.is_admin` — LD has numeric levels 0–3; house gated health at L3. Decide:
   LD health = admin-only (level ≥2) vs super-admin (level 3). Recommend **level ≥2**
   since LD's whole `/admin` is already admin-gated and there's no L1 public-admin.)
   + `+page.svelte` (health panels) + `_page.stories.ts`.
3. **Trim `/admin/analytics/+page.svelte`** to the USAGE panels; move the HEALTH
   panels + their `<style>` rules + derived helpers into `/admin/health/+page.svelte`.
4. **Admin nav** — add a "Health" link beside "Analytics" in `admin/+layout.svelte`
   (or wherever the admin nav lives — verify).
5. Update `_page.stories.ts` for both pages; svelte-look verify light+dark; keep the
   `insights.test.ts` mock (already has all fields incl. `server_faults`).

## Panel taxonomy (current LD analytics page → destination)
USAGE (`/admin/analytics`, keep):
- Headline cards + insights strip (sessions/users/errors headline, WoW, engagement)
- Traffic (sessions vs users, deploy markers)
- Top routes (by distinct sessions) · Top events
- Agent API activity (api_v1)  ← L8, keep with usage (agent editing-parity story)
- Geography (areas + TTFB — TTFB is arguably health; house kept latency-by-geo in health.
  Recommend: areas→usage, TTFB→health, OR keep whole Geography in usage for simplicity)
- Browsers & devices (capability)
- Event coverage (self-instrumentation) — house put this in HEALTH; recommend health.

HEALTH (`/admin/health`, move):
- Pipeline verdict + schema-drift banner (missing_syncable_tables)
- **Server faults** (RS1) + Errors per day + Errors by build version + Leader-worker DB health
- Performance (client timings p50/p95) + Core Web Vitals
- By source + Error clusters
- (Event coverage per above)

## Files touched
- `site/src/routes/api/admin/analytics/+server.ts` (+`_call.ts`) — optional `section` param
- `site/src/routes/admin/analytics/{+page.ts,+page.svelte,_page.stories.ts}` (trim)
- `site/src/routes/admin/health/{+page.ts,+page.svelte,_page.stories.ts}` (new)
- `site/src/routes/admin/+layout.svelte` (nav link) — verify path
- No `log-analytics.ts` change needed under the shared-builder approach.

## Verify
- `pnpm test` (no data-layer change → analytics tests stay green)
- `tsc` + `pnpm check`
- svelte-look both pages, light + dark, Default + empty stories.

## Open decisions for Jacob
1. Health gate: admin (≥2) vs super-admin (3)?  [recommend ≥2]
2. Split the builder for efficiency, or keep the shared full builder?  [recommend shared]
3. Geography TTFB + Event coverage: usage or health?  [recommend TTFB→health, coverage→health]
