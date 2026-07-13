# Analytics / Health split — make `/admin/analytics` shareable with all admins

Goal: `/admin/analytics` becomes a clean **usage** page fit for every admin's eyes;
`/admin/health` keeps the operator/diagnostic detail. Then mirror the relevant changes to
**house** (also has the analytics/health split) and **tutor** (single-admin, no split — apply
what still makes sense).

Files:
- LD analytics view: `site/src/routes/admin/analytics/AnalyticsView.svelte`
- LD health view: `site/src/routes/admin/health/HealthView.svelte`
- Glance: `site/src/lib/analytics/AtAGlance.svelte` (+ `at-a-glance.ts`)
- Deploys panel (byte-identical across all 3 repos — see health/PARITY.md): `DeploysPanel.svelte`
- Data: `site/src/lib/db/server/log-analytics.ts` (geo areas: `build_capability` + `build_geo_areas` + `query_window_sessions`)

## A. `/admin/analytics` — BOTS audience trims
- [ ] Remove **Unique users** card (always 0 for bots)
- [ ] Traffic chart: drop the **Users** line (sessions only)
- [ ] Remove **Top dictionaries by unique visitors** section
- [ ] Remove **Agent API activity** section (humans behind API keys — not bot traffic)
- [ ] Remove **Missing translations** section
- [ ] Remove **Browsers & devices** section
- [ ] KEEP: Sessions card, Traffic (sessions), Top routes, Top events, **Geography**

## B. `/admin/analytics` — HUMANS audience
- [ ] AtAGlance: keep People / Experience / Where; **hide the "For you" attention box** (add a
      prop, e.g. `show_attention={false}`; attention already renders on health)
- [ ] Remove **Log rows** card (both audiences — belongs on health)
- [ ] Remove **Logs / session** insight (engagement depth) box
- [ ] Traffic chart deploy markers: see decision Q1
- [ ] Move **Missing translations** to below **Browsers & devices**
- [ ] Geography: clarify header (numbers = located *sessions*/visits per region, not people) +
      filter admins — see decision Q2

## C. `/admin/health`
- [ ] Add the **"For you"** attention box (already rendered via full AtAGlance — keep as-is)
- [ ] Deploys chart: add horizontal gridlines with minute labels (DeploysPanel — mirror to all 3)
- [ ] Remove **Event coverage** section
- [ ] Remove **Error clusters** section
- [ ] Move **Core Web Vitals** higher (→ right after "Speed at a glance")
- [ ] Build adoption: keep the top % stats, remove the long per-build **table** (signed-in users)

## D. Cross-repo (after LD verified)
- [ ] house: same analytics/health split trims (its AnalyticsView/HealthView)
- [ ] house + tutor: DeploysPanel gridlines (byte-identical mirror)
- [ ] tutor: single admin → no audience split, but apply the health CWV move, deploys gridlines,
      drop event-coverage/error-clusters/build-adoption-table if present; sanity-check analytics

## Decisions (settled)
- **Q1 deploy markers → keep_fix.** Aggregate `deploy_events` to ONE event per DAY in the views
  (label=count, note lists that day's builds), and lower shared `EVENT_GAP` 28→16 in ComboChart so
  distinct days separate into per-day ticks instead of one 86-blob. Single-deploy days show just the
  ⬆ icon (no wide count chip → no overlap); multi-deploy days show ⬆N; click for detail.
- **Q2 geo admin filter → durable, geo-only.** Add `user_id TEXT` to `log_daily_sessions` (migration +
  Drizzle + writer). Exclude admin (level ≥2) sessions from the geography area tally only — in
  `build_capability` (reader, primary) + the `geo:` metric rollup (fallback). Everything else
  (session/user counts, device/OS/browser) keeps admins. Heals over ~30d as fresh data rolls in.

## Notes / findings
- `DeploysPanel.svelte` + `deploy-metrics.ts` are byte-identical across tutor/house/LD (PARITY.md) — mirror in lockstep.
- `ComboChart` / `EventRail` / `cluster-events` are "keep in sync" shared charts.
- "86" on the traffic chart = 86 distinct `app_version`s (deploys) in-window all clustering at the recent edge; `build_deploys` groups by app_version.
- Geo areas: built in `build_capability` from `window_sessions` (cold `log_daily_sessions` rollup + live hot rows) + a cold `geo:` metric rollup seed. `window_sessions` carries `has_user_id` (bool) but NOT the actual `user_id`, and the cold rollup has no user dimension → filtering admins across the full window needs threading `user_id` through the live query (partial) and/or a rollup change (durable, future-data only).
- Admin identity: `$lib/admins.ts` allow-list is by email; sessions carry `user_id` → need a users-table lookup (email→id) for admin user_ids.
