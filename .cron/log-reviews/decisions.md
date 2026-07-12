# Standing decisions — living-dictionaries log-review

Durable Jacob decisions this lane must honor. **Read this FIRST, before the dated digests.**
Maintenance: dated one-liners; add on a durable debrief decision (declines, kill-list items,
standing baselines); DELETE once shipped or obsolete. Keep it small — standing law, not a log.

- **2026-07-09 — stale-client `sync_failed` storms: IGNORE.** Greg's stuck tab is a forgotten old
  laptop (he's been nudged); **no forced-reload mechanism will be built.** Stale-tab/stale-build
  retry noise is KNOWN-NOISE — filter it from triage, stop re-raising it, drop the carried
  "stale-client recovery" coverage item.
- **2026-07-07 — the conlang fork is fenced off from mission reporting.** Don't count it or
  report on it.
- **2026-07-05 — `api/email/html/new-user-welcome.ts`: KEEP** even though it's orphaned — Jacob
  is handling welcome emails separately. Not a dead-file candidate.
- **2026-07-09 — `logs.db` VACUUM-after-prune: approved & dispatched** (worker `4a4593e3`).
  Crawl-driven log growth during the SEO crawl is expected — only escalate if growth stays steep
  after the crawl settles.
- **2026-07-09 — crawler noise:** `live_query_failed` proved 98.5% Googlebot; treat crawler
  misuse / bot boot-cascade rows as known-noise pending the fleet noise-floor artifact
  (worker `74d5d94a`). Same known-noise family: `[orama-watcher] delta scan failed`,
  `initial dict sync failed`, `Rejected` (serviceWorker.register — all anon/bot prerenderers),
  stale-build dynamic-import/CSS-preload 404s during blue/green swaps. **Also in this family
  (confirmed 2026-07-10 run 2):** `leader_boot_failed` (mostly anon/Googlebot, `will_retry:true`,
  "module script canceled" mid-boot + "disk image malformed" on bot OPFS) and `Failed to read dict
  bundle from wa-sqlite` (`sqlite_code:21 MISUSE`, `retried:true`) — both self-heal; don't re-triage.
- **2026-07-10 — entry-page `effect_update_depth_exceeded`: essentially CLOSED.** Collapsed 57→1 on
  build `1783663107615` after `daed5d93`/`24b080b1`/`42f737d7`. Watch the residual 1; don't
  re-propose the fix (documented in-code at `entry/[entryId]/+page.svelte` L62–71).
- **2026-07-10 — dashboard route/nav/homepage perf split ALREADY SHIPPED** (`RoutePerf` per-route
  page_load p95, navigation-by-destination split, LCP-by-distance, CWV, boot-health). Don't
  re-propose per-route or homepage-vs-entry perf panels. The open gap is a `dict_boot` cold/warm
  timing (needs a new client `track_timing` first).
- **2026-07-11 — featured-entry ⭐ `UNIQUE` error: CLOSED.** 0 occurrences (was 12 on 07-10); the
  residual-race fix held. Don't re-raise.
- **2026-07-11 — new zombie tab in the `sync_failed` storm is a non-admin (Marlene, ~4.6k/day
  null-session).** Same known-noise family as Greg's stale tab (2026-07-09 ruling); no forced-reload
  will be built. Don't re-triage individual stale-tab clients.
- **2026-07-11 — waveform ▶ play-before-init bug** (`Waveform.svelte` `wavesurfer.play()` on undefined
  during async wavesurfer.js import): long-standing 🟡 P3, fix = null-guard. Action item filed; not a
  regression. Guaycura is a REAL Baja dictionary (MX-BCS), not the conlang fork.
