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
- **2026-07-12 — waveform ▶ play-before-init bug: CLOSED.** Commit `56a40b63` replaced wavesurfer.js
  with a static canvas `Waveform.svelte` (plays via a plain `<audio>` element) — the async-import race
  is gone entirely. 0 occurrences (was 7). Don't re-raise; the proposed null-guard is moot.
- **2026-07-12 — search `RangeError: Maximum call stack size exceeded` on `/opata/entries?q="Flores"`:**
  new low-freq 🟡 P3 WATCH. iPhone/Chrome-iOS, MX-Sinaloa, 2 rows/1 user/1 session, retired build.
  Minified `Sk@/Qk@` recursion — NO confident fix, do not guess. Only act if it recurs on the current
  build or from a 2nd user (then drill + repro with sourcemaps). Opata & Guaycura are REAL dictionaries,
  not the conlang fork.
- **2026-07-12 — LD dashboard is AHEAD of siblings on: thin-data perf guard (`THIN_SAMPLE_N=15`) + the
  At-a-Glance strip.** Both are being ported FROM LD by house/tutor — don't accept them as inbound Phase D
  ports; they're LD-originals. **Also LD-ahead: the Sync-health stuck-(user,dict) panel** (`build_sync_health`,
  `/admin/health`) — house's proposed "wedged clients" indicator is the same idea; don't accept it as an
  inbound port.
- **2026-07-13 — SEO/bot crawl SETTLED.** Volume dropped 184k→33k (−82%), host CPU avg back to ~2%,
  `logs.db` growth 300MB/day → 66MB/day. New baseline: treat a return to 100k+/day as a *new* crawl to
  investigate, not the old one. The 07-12 "watch logs.db growth" item is effectively resolved.
- **2026-07-13 — `sync_failed` `kind:client_behind`/`schema_outdated` 409 on a live-session (non-null)
  tab is the SAME known-noise stale-build family** as the null-session zombies — a migration shipped and
  the old tab can't sync until reload. Already surfaced by `build_sync_health.stuck[]`. Don't re-triage
  individual stuck tabs (e.g. evelyn/solari 07-13); no forced-reload (07-09).
- **2026-07-13 — Phase D: tutor + house have SHIPPED LD's two open error-cluster items** (bot-share % +
  `max_per_session` ⟳-loop marker; tutor's `build_error_clusters` has both live). Next time these come up,
  port tutor's implementation rather than re-designing — the design is proven in two apps.
- **2026-07-14 — error-cluster bot-share % + ⟳-loop marker SHIPPED in LD** (`build_error_clusters` now has
  `bot_pct` + `max_per_session`). Don't re-propose. **`dict_boot` cold/warm dashboard timing also SHIPPED**
  (`build_dict_boot`, avg ~2.3s live) — the 07-10 "dict_boot coverage gap needs a client track_timing"
  item is CLOSED; don't re-raise it.
- **2026-07-14 — Greg's "river" zombie tab is the SAME forgotten-laptop stale-tab family** (07-09): null
  session, dict slug `river` 404 `dictionary not found`, ~1,528/day, inflates his event count. Known-noise,
  no forced-reload. Don't re-triage; just subtract it from his real activity.
- **2026-07-14 — `Unable to decode audio for waveform` (`Waveform.svelte:80`): NEW 🟡 P3, cosmetic.**
  Freshly-recorded audio; waveform peaks fail to decode; playback (plain `<audio>`) unaffected. 2 real
  users (Android-Chrome + Mac-Safari). The logged `error` serializes to `{}` — **first fix is to enrich
  the log** (name/message/mime/bytes/source), THEN diagnose. Don't guess a fix blind. Watch for recurrence.
- **2026-07-14 — i18n missing-key warns (~800/day, mostly EN `ps.*`/`sd.*`) are non-canonical hand-typed
  POS/semantic-domain labels, NOT catalog bugs** — already surfaced on `/admin/analytics` missing-i18n
  panel (working as designed). Don't treat as an error or propose a panel. Only `gl.default`/he-type single
  keys are real `/translate` gaps.
- **2026-07-14 — NO wedged-client dashboard panels.** Jacob: "wedges are your job to find and fix, not
  mine to watch and observe in a dashboard." Stop proposing sync-halt / wedged-client indicator panels.
  Surface wedges as ACTIONABLE nightly-digest items (fix or human-nudge), not a dashboard to watch.
  (Applied 07-15: the carried "sync-halt terminal-wedge panel" backlog item is DROPPED per this ruling.)
- **2026-07-15 — grammar `props_invalid_value` P3 (preview-only): root cause PINNED, fix pending.**
  `SectionEditor.svelte` `bind:value={draft_body[bcp]}` / `draft_usage[bcp]` (undefined for absent
  locales) into `MarkdownEditor` `value = $bindable('')` → Svelte throws. Admin-3-gated preview only
  (`/[dict]/grammar`, new structured-grammar UI), zero real-user exposure; only Jacob hits it. Fix = drop
  the `''` fallback or pre-seed the locale key. Don't re-derive the cause next run; it's in current code
  until fixed.
- **2026-07-15 — `nyishi` dict-worker `Maximum call stack size exceeded` halt: WATCH.** 1 anon worker
  `sync_halted_repeated_failure` today; echoes the 07-12 Opata search recursion. Only drill nyishi's data
  if a REAL contributor reports a broken boot; a single null-user worker instance is not actionable.
- **2026-07-15 — LD is AHEAD on known-noise classification.** The command's standing Phase-D note that
  "LD's raw recent_errors lacks error-cluster + known-noise classification" is STALE — LD has
  `is_noise_msg` UDF + `real_errors` rollup + cluster `is_noise` (`log-analytics.ts` / `classify-error.ts`).
  Don't accept it as an inbound port. Open cross-browser gap: add `Importing a module script failed.` +
  `Unable to preload CSS` to `KNOWN_NOISE_PATTERNS` (build-next, backlog).
