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
- **2026-07-16 — grammar `props_invalid_value` P3: CORRECTED — NOT admin-3/preview-only; real
  shared-editor bug, fix pending.** The 07-15 "admin-3 preview only, only Jacob" framing is WRONG:
  `GrammarSection.svelte` (`can_prose_edit`, L32-35) opens `SectionEditor` in `prose_only` mode for any
  dictionary **manager** editing grammar intro prose. 07-16 it fired for 2 NON-admin users. Zero *mission*
  impact only because they were on `bucket:"conlang"` dicts (cormani/lunvot/rhenic — fenced, 07-07); it
  WILL hit a real-dict manager once they edit grammar. Root cause (still pinned): `SectionEditor.svelte:146/159`
  binds `draft_body[bcp]`/`draft_usage[bcp]` (undefined) into `MarkdownEditor` `value = $bindable('')`
  (`:32`). Fix = drop the `''` fallback or pre-seed the key. Keep as a REAL P3, not preview-only.
- **2026-07-16 — waveform-decode P3: ENRICHMENT SHIPPED, diagnosed, CLOSED.** `Waveform.svelte:83` now
  logs `{name,message,mime,bytes,source}`; the rows reveal root cause = transient `NetworkError` fetching
  the audio URL (`source:"url"`), NOT a codec issue. Cosmetic (playback via `<audio>` unaffected). Don't
  re-raise the enrich item or a codec fix; only revisit if it recurs at volume (→ R2/CDN audio delivery,
  not the decoder).
- **2026-07-16 — `real_errors` rollup is ~100× inflated by known-noise the classifier doesn't catch.**
  The forever metric reads ~1,600–2,000/day but genuine user-facing errors are a handful; the bulk is the
  null-session `sync_failed` zombie storm (~1,384/day, one tab) + anon/bot `leader_boot_failed` + bot
  `Internal Error` 500s — none in `KNOWN_NOISE_PATTERNS`. Two backlog fixes filed (fold null-session
  `sync_failed`/`leader_boot_failed` out of `real_errors`; add the cross-browser stale-bundle strings).
  Don't re-derive this each run; it's a metric-honesty backlog item, not a new error to triage.
- **2026-07-16 — Phase D inbound port ACCEPTED from tutor: persist `/admin/analytics` compute cost.**
  LD has the identical ephemeral `[profile]` `console.log` pattern (`log-analytics.ts:750`); adopt tutor's
  `admin_analytics_computed` server-event-per-uncached-compute so dashboard load-perf becomes a trend.
  Filed to backlog (LOW). Don't re-propose the design; port tutor's.
- **2026-07-15 — `nyishi` dict-worker `Maximum call stack size exceeded` halt: WATCH.** 1 anon worker
  `sync_halted_repeated_failure` today; echoes the 07-12 Opata search recursion. Only drill nyishi's data
  if a REAL contributor reports a broken boot; a single null-user worker instance is not actionable.
- **2026-07-18 — CSV export `friendly-name.ts` glosses crash: CLOSED, verified fixed in prod.** The
  `entry.senses?.[0]?.glosses` optional-chain fix (all 3 refs) shipped in build `1784341957685`; **0
  `glosses` errors in 24h**, the only 6 rows in 48h are all on the pre-fix build `1784294143202` (last
  07-17 13:56 UTC). Close `.issues/export-friendlyname-glosses-crash.md`. Don't re-raise.
- **2026-07-17 — Phase D: LD ALREADY ships the malformed-`context` 500 guard on BOTH sides.** Read:
  `log-analytics.ts` has 56 `json_valid(context)` guards / 0 unguarded `json_extract(context)`. Write:
  `insert-client-log.ts` `stringify_context_capped` never persists invalid JSON (tests for oversize + circular).
  house's 07-16 "LD has NOT" flag is STALE — DECLINE the inbound port, broadcast back. Don't accept this port
  next run; don't re-verify unless the code changes.
- **2026-07-15 — LD is AHEAD on known-noise classification.** The command's standing Phase-D note that
  "LD's raw recent_errors lacks error-cluster + known-noise classification" is STALE — LD has
  `is_noise_msg` UDF + `real_errors` rollup + cluster `is_noise` (`log-analytics.ts` / `classify-error.ts`).
  Don't accept it as an inbound port. Open cross-browser gap: add `Importing a module script failed.` +
  `Unable to preload CSS` to `KNOWN_NOISE_PATTERNS` (build-next, backlog).

- 2026-07-17 — **Free-form user-entered i18n values are DATA, not UI strings — render raw, no warn, no translation, no catalog promotion** (Jacob). Applies to custom semantic domains (`sd.*`, e.g. wenshanhua's 706 warns) AND free-form parts of speech (`ps.*`/`psAbbrev.*`, e.g. Italian `ps.v-è`/`psAbbrev.v-isce`/`psAbbrev.expr` on `1p-emanuscript`). These are NOT fill-translations gaps — the write path passes unknown values through verbatim by design. Code fix dispatched (living-dictionaries/f9fb21c3) to gate free-form values out of the missing-key i18n warn path entirely. STOP re-flagging these warns as actionable; do NOT propose promoting them into the en.json catalog (Jacob declined).
- **2026-07-22 — Dashboards favor interpretation and speed over raw inventories.** Minimize lists and contextless totals; maximize useful charts, trends, thresholds, comparisons, and action items. Treat fast initial load as product quality and defer low-value computation.
- **2026-07-22 — Svelte state must be de-proxied at structured-clone boundaries.** Any `$state` value sent to a worker or other structured-clone boundary must first become plain data with `$state.snapshot`.
- **2026-07-21 — entry-filter structured-clone P1 is CLOSED.** Commit `f4c3d8bc` snapshots the Svelte proxy array before Comlink; all residual rows ended on retired builds by 00:21 UTC and the current build has zero. New distinct watch: persistent per-dictionary OPFS recovery, filed in `.issues/dict-boot-persistent-opfs-recovery.md` after a partially applied Ngemba client migration.
- **2026-07-22 — three top backlog items SHIPPED in one commit `d6871c60` (06:08 UTC):** (1) `real_errors` null-session zombie exclusion (`log-analytics.ts:1218` `AND NOT (session_id IS NULL AND message IN ('sync_failed','leader_boot_failed'))`), (2) cross-browser stale-bundle strings in `KNOWN_NOISE_PATTERNS` (`classify-error.ts:24-26`: `Importing a module script failed.` / `Unable to preload CSS`), (3) OPFS dict-boot recovery hardening + telemetry. Import/media upload enrichment (`import_upload_failed`/`media_upload_failed`) also landed. Don't re-raise ANY of these four — they're DONE and deployed in build `1784714151639`. Next run: confirm `real_errors` headline dropped to ~30-50/day on finalized rollups.
- **2026-07-22 — OPFS dict-boot recovery: telemetry works, HEALING does not yet.** New `dict_boot_recovery_exhausted`/`dict_boot_recovered` events fire correctly and BOUND the re-election loop (was the point), but 24h showed **7 exhausted / 0 recovered**. The genuine open case: signed-in iOS `alclaveria`/`boienen` `sqlite3_open_v2` at `opfs_open` — reset-from-snapshot refuses because it can't open the file to prove dirty-state. Anon/webdriver `kalinago`/`ngabere` were stale-bundle worker-chunk fetch failures (reset can't help, correct). This is the still-open iOS/Android checkbox in `.issues/dict-boot-persistent-opfs-recovery.md`, NOT a new bug. Surface as digest action item, not a dashboard panel (07-14 no-wedged-panel ruling). `dict_boot_recovery_exhausted` on anon/webdriver/stale-bundle sessions = known-noise; only the current-build signed-in ones are real.
- **2026-07-22 — the crawl is the SAME re-intensified Googlebot-mobile (Nexus 5X) SEO indexing, sustained 120-172k rows/day since 07-19** (roughly flat, not growing). Benign, host CPU 3.8% avg. US-SC "human" sessions (~122) are residual datacenter/crawler leakage my rough UA filter misses — NOT real audience; the prod dashboard's `is_bot_ua`+webdriver filter is stricter. Don't re-investigate as a new crawl per the 07-13 baseline; just watch `logs.db` size (2.33GB, ~230MB/day, fine at 18% disk).
