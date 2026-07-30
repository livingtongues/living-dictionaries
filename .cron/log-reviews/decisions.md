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
- **2026-07-26 — `dirty_rows_stuck` is DOMINATED by inherited server-side flags, not real wedges.**
  5,437 stale `dirty=1` rows across **33 dictionaries**, all in `entry_dialects`/`entry_tags` — the
  unpatched 07-21 Yokoim root cause, now quantified in `.issues/yokoim-dirty-rows-stuck-2026-07-20.md`.
  Pull-only clients inherit them via the snapshot and warn forever. Don't re-triage individual
  `dirty_rows_stuck` rows on affected dicts, and don't treat them as lost user work; the fix is the
  server-merge normalization + a one-off cleanup. A row only deserves triage if the reporting user
  HOLDS a role on that dictionary.
- **2026-07-26 — satori (`/og`) cannot decode WebP; the 07-23 photo→R2 migration broke every share
  card's photo.** 111 failed renders/day, degrading to text-only cards. Filed
  `.issues/og-share-image-webp-regression.md`. Once fixed, `og_render_failed reason:"image_fetch"`
  should be ~0 — the residual `reason:"font"` handful stays known-noise. Standing rule: any future
  media-format migration must check the share-card path.
- **2026-07-26 — `/admin/analytics` cold compute BLOCKS the whole site (11–80 s) and caused real
  HTTP 502s.** Accepted inbound Phase D port from house (already built there): breathe/stage yielding,
  disk-persisted cache, single-flight cold miss, index jump-scan for distinct user agents. Tracked in
  `.issues/analytics-compute-blocks-server.md`. Don't re-derive the diagnosis; don't propose new
  dashboard panels until this ships.
- **2026-07-26 — the newest day on any daily chart is systematically OVERSTATED (~18%).** Live-tail
  session counts finalize downward when the rollup reclassifies crawler sessions (07-25: 651 live →
  536 finalized). Always label the last point partial in reports; a backlog item exists to do it on the
  dashboard.
- **2026-07-26 — audio `play()` rejections (`Failed to load because no supported source was found`)
  are UNDIAGNOSABLE until enriched.** Rising 1→19/day across real anonymous visitors, but all
  referenced R2 audio objects verified 200/correct content-type. `Audio.svelte` calls `play()` with no
  catch, so rows carry no url/error name/readyState. ENRICH FIRST (`audio_play_failed`), then diagnose
  — same rule as the 07-14 waveform-decode case. Don't guess a fix.
- **2026-07-22 21:04 — viewer OPFS replacement HEALS but is not session-bounded.** Current build `1784732741243` produced the first real recoveries (iPhone `iipay-aa`; Android `poqomchi`), closing the "0 recovered" watch. But the iPhone emitted 36 `dict_boot_file_replaced` rows over 9 minutes because the once-only budget resets with each worker re-election; all replacement rows also lost `session_id` during the root-onMount/child-boot race. Keep the existing OPFS issue open for a cross-worker session bound + correlation; editor recovery remains separately deferred.
  **↑ 2026-07-26: the session-bound watch is CLOSED** — 161 `dict_boot_file_replaced` rows across 161
  sessions, `max_per_session = 1`, with `session_id` present. Only the signed-in-editor recovery case
  (1 exhausted row, iPhone/`boienen` `sqlite3_open_v2`) remains open in the issue.
- **2026-07-27 — ANALYTICS AND TELEMETRY MUST NEVER BLOCK A REQUEST PATH (Jacob, standing law).**
  "Analytics are supposed to help me and speed me up, not slow me down… it shouldn't be blocking."
  Any admin/analytics/telemetry computation that is expensive is **precomputed, warmed off-request, or
  deferred** — never run synchronously in front of a user. Concretely, as shipped this night:
  `get_log_analytics` is async + stage-chunked (`breathe()` between every blocking stage), single-flighted
  on the cold miss, persisted to `DATA_DIR/analytics-cache/*.json` so a deploy never hands the next
  admin a cold compute, and **warmed** from the retention cron's `after_sweep` hook (the moment the
  watermark advances) plus 30 s after boot. When adding an analytics query, the question is not "is it
  fast enough" but "whose request pays for it" — the answer must be "nobody's".
- **2026-07-27 — an image-format migration silently breaks satori-based share rendering; CHECK THE
  SHARE-CARD PATH WHENEVER MEDIA FORMATS CHANGE (standing outbound rule, adopted fleet-wide).**
  Verified this night rather than assumed: **upgrading satori does not help.** satori ≥ 0.26 parses
  WebP, but satori only emits `<image href>` into an SVG — the rasterizer is `@resvg/resvg-js`, and
  2.6.2 (the newest release) still decodes only PNG/JPEG/GIF/SVG. A bump would merely convert a loud
  `og_render_failed` into a silently photo-less card. The durable fix is to make `/og` format-agnostic:
  `routes/og/card-image.ts` transcodes anything undecodable to a JPEG data URI before rendering. Two
  traps it cost to find: satori **cannot measure a data URI** (needs explicit `<img width height>` or it
  throws "Image size cannot be determined"), and satori resolves a percentage width against the parent's
  CONTENT box (the card photo had always stopped 96×72 px short of the edges).
- **2026-07-27 — the `/og` share-image endpoint is the new top production risk: it took the WHOLE SITE
  down five times in one evening.** Caddy logged **1,553 `no upstreams available`** (both blue AND green
  unhealthy at once) and 21 signed-in users hit HTTP 502. Every non-deploy outage minute (17:35,
  18:44–45, 19:00–04, 19:50, 20:19–21) coincides with an `/og` render burst on a ~5-min crawler cycle.
  Reproduced on demand in prod: 8 concurrent card renders push trivial `/healthz` to **3,251 ms** vs
  Caddy's 2 s health timeout. Cost is satori+resvg (~700–840 ms/card, synchronous), NOT sharp (56–88 ms).
  Three unbounded properties: unbounded PNG `Map` cache (serving container 2.87 GiB vs idle standby
  1.17 GiB after 7 h ⇒ ~1,000 renders/hour), unbounded concurrency, unbounded outbound fetches (Google
  Fonts fetch has NO timeout). Tracked in `.issues/og-endpoint-load-outages.md`. Don't re-derive.
- **2026-07-27 — the 07-26 WebP share-card fix WORKED and must NOT be reverted.** Photo verified back on
  a live card; `og_render_failed reason:"image_fetch"` 280/day → **0** since 05:11 UTC. Two follow-ons
  are NOT new bugs: (a) `og_image_transcode_failed` (84/day) is transient R2 fetch timeout *caused by*
  the load above, not a codec fault; (b) `reason:"font"` 3→127/day is the pre-existing opentype
  `lookupType: 5 - substFormat: 3` failure **unmasked** now that the image no longer throws first — the
  card still renders via `static_fonts_only`, cost is tofu boxes for unbundled scripts (Manchu confirmed
  visually). Don't re-triage either as a regression.
- **2026-07-27 — the 5,437 phantom `dirty` flags are GONE.** Full scan of all 1,284 dictionary DBs:
  **0 stale flags, 0 dictionaries**. The 07-26 fleet-wide finding is closed server-side; the only residue
  is client-local on stale tabs (`boienen-old-buhi-langua`, 2 rows, anon, build 1784893994761) — the
  known `.issues/client-side-phantom-dirty-residue.md` case. Stop re-raising the server-side cleanup.
- **2026-07-27 — a 5-minute synthetic uptime probe CANNOT see a 1–3 minute outage** (LD reported 99.3%
  availability on a day with five total outages). Standing instrument rule: percentile/latency panels and
  5-min probes are the wrong tools for short total outages — user-observed 5xx (`sync_failed` `status`)
  is the honest availability signal. Broadcast to house + tutor; all three share the blind spot.
- **2026-07-27 — `dict_boot_recovery_exhausted` is NOT session-bounded** (the successful-replacement path
  is). One anon iPhone on `tuscarora` emitted 38 rows in one session / 77 across three. Known iOS
  `sqlite3_open_v2`@`opfs_open` case in `.issues/dict-boot-persistent-opfs-recovery.md` — bound the
  give-up path so one device can't dominate error counts; don't re-triage the device.
- **2026-07-27 (Jacob, OVERRIDES two prior standing decisions — now law) — robot classification is ONE
  canonical copy, adopted VERBATIM, guarded by a drift test.** The file is
  `site/src/lib/utils/bot-user-agent.ts` (byte-identical in house/LD/tutor; LD adopted house's copy
  2026-07-28), and LD's guard is `bot-user-agent.parity.test.ts`. What was endorsed is house's
  **precision**: word boundary on `bot|crawler|spider`, device-brand stripping (CUBOT is a phone), and
  `whatsapp` counting only without a `mozilla` token. **The two exports have opposite missing-UA policy
  — anything gating a whole app surface must use `is_bot_user_agent` (missing UA = human).** LD's
  dictionary boot gate hands a robot a null session, so failing closed there = a blank application.
  Don't re-propose per-repo matchers; don't "simplify" the two exports into one.
- **2026-07-28 — `/og` shape repaired: render once + persist, time-budget the renders.** Approved four
  repairs landed (disk store under `<DATA_DIR>/og-cache`, bounded renders, capped in-process caches,
  timed-out font fetch). Measurement changed the plan twice and the lessons are now standing:
  **a concurrency limit alone is nearly a no-op on a single thread** (a burst arrives as a backlog, not
  as concurrent handlers — every render logged `wait_ms: 0`), and **a microtask slot-handoff makes
  starvation WORSE** (18.3 s `/healthz`; hand off with `setImmediate`). Writeup:
  `.knowledge/server/synchronous-work-on-the-request-thread.md`. Residual: worst case is still ~1–2
  render durations; the real cure (render off the main thread) is NOT done.
- **2026-07-28 — `/og` worker isolation fixed the AVAILABILITY fault but failed its first production
  quality check.** Commit `2561a72c` ended user-observed HTTP 502 sync failures (last at 05:30 UTC,
  before deployment), so never move satori/resvg back onto the request thread. Open residual in
  `.issues/og-render-off-main-thread.md`: 72 twenty-second worker timeouts plus a post-12:15 storm of
  failed text-only fallback renders; degraded generic cards are P2 share quality, not P1 site outage.
- **2026-07-28 — `audio_play_failed` now separates expected control flow from a real object fault.**
  `AbortError` saying `play()` was interrupted by `pause()` is expected tap/close behavior and should
  not warn. `NotSupportedError` + media error code 4 remains actionable; tonight's concrete object is
  `norsii/audio/92d2d861-9ee1-4993-9969-c2823aa3dcfa/1763654313463.wav`. Inspect bytes/headers/codec
  before proposing a player fix.
- **2026-07-28 run 2 — the worker isolation DID fix availability; stop re-checking it.** Only ONE
  `sync_failed` HTTP 502 (20:51 UTC, Greg/iquito) in the 15 h after the 05:47 deploy, vs 20–44/hour
  before. Never move satori/resvg back onto the request thread.
- **2026-07-28 run 2 — `audio_play_failed` "no supported source" is CLIENT-SIDE STALE PATHS, proven,
  not lost media.** All failing URLs 404; server dict DBs hold 0 legacy paths (tutelo-saponi 0/1,540,
  iipay-aa 0/4,663, norsii 0/216); the `media_objects` ledger has 0 `audio/dict_%` keys of 234,497 and
  0 orphaned; canonical URLs 200. The 07-23 migration rewrote paths without marking rows changed, so
  existing browsers never pull the correction — hence the client-side repair migration
  (`20260728_repair_legacy_audio_paths.sql`, also uncommitted). Don't re-investigate R2 or the sweep
  cron for this family. **2026-07-29: the migration SHIPPED** (`site/src/lib/db/schemas/dictionary-migrations/20260728_repair_legacy_audio_paths.sql`, committed) and `audio_play_failed` fell to 2 rows/day. Closed.
- **2026-07-28 run 2 — `admin_analytics_computed` fires ONLY on the request path
  (`routes/api/admin/analytics/+server.ts:44`), so moving compute to the warm path made dashboard
  cost UNMEASURABLE** (caches rewritten 17:26 UTC today; newest event 07-25). Generalized lesson,
  broadcast to house + tutor: when work moves off the request path, its cost telemetry must move with
  it (add a `trigger` field). Don't read "no events" as "no computes".
- **2026-07-29 — the 07-28 Resvg `unwrap exclusive reference` storm is CLOSED, verified in prod.**
  8,184 `og_render_failed reason:"render"` rows, ALL before 01:30 UTC; `og_card_rendered` has run
  continuously since 02:00. The serialization fix deployed (commits `1a169a89` / `a81734e2`). Don't
  re-raise; don't re-derive.
- **2026-07-29 — the `/og` disk store THRASHES: `MAX_ENTRIES = 1000` against an unbounded card space.**
  Cards average 173 KB so the ENTRY cap binds first (store: 1,015 files / 176 MB of a 250 MB byte
  budget), and the store is permanently full and evicting. Measured cost: **18,174 renders/day for
  1,000 slots** (~18 re-renders per stored card per day), **36,346 shed requests = 55% of all `/og`
  traffic answered with the generic card**, ~7.8 core-hours/day. Render cost itself is FINE (p50 452 ms,
  p90 1.6 s) — the fault is volume, not speed. Fix is a budget (≈20,000 entries / 3.5–4 GB on a 75 GB-free
  disk), not an architecture change. **house has the byte-identical cap** (`site/src/lib/server/satori/
  card-store.ts:44`) and shipped its store on 07-29 — broadcast outbound.
- **2026-07-29 — a card store with NO hit-rate telemetry looks healthy while thrashing (standing
  instrument rule, fleet-wide).** `routes/og/+server.ts:113` returns a stored card with zero telemetry,
  so the endpoint's denominator is unknowable and the filed health-line panel's "success rate as % of
  attempts" would have read 96% on a night when 55% of shares served the generic card. Backlog item
  CORRECTED in place — don't build it against the render-only denominator.
- **2026-07-29 — `dict_boot_recovery_exhausted` unbounded-loop is now PROVEN to distort the error
  headline, on DESKTOP CHROME.** One anonymous Windows/Chrome-150 tab on `bahasa-lani` (public,
  369 entries, healthy 1.35 MB server snapshot; every other session opened it fine) emitted 839
  `leader_boot_failed` + 421 exhausted rows over 5 h — **74% of all client error rows**, pushing
  `real_errors` 117 → 312. `dict-session.ts:91` logs on every callback with no cap. Third and worst
  instance of the 07-27 "bound the give-up path" item. Also: nothing consumes `recovery_exhausted`, so
  the visitor watched `DictBootProgress` spin for five hours — a user-facing failure surface is needed.
  Don't re-triage the device; fix the bound.
- **2026-07-29 — `og_render_failed reason:"font"` is effectively ONE dictionary.** 1,486 of 1,536 daily
  font failures are "Torwali English Urdu Dictionary" (tail: Judeo-Kashani, Hazaragi, Kholosi — all
  Arabic-script). Pre-existing opentype `lookupType: 5 - substFormat: 3`, unmasked (not caused) by the
  07-26 WebP fix per the 07-27 ruling. Each costs a DOUBLED render (`static_fonts_only` retry) and still
  ships tofu. Bundling a working Arabic-script face fixes appearance AND removes ~1,500 renders/day.
- **2026-07-29 — the `db_tier` mix is now 100% `opfs-worker`** (904 of 904 sessions, zero `idb-worker` /
  `idb-main` / below-capability). The leader-elected OPFS worker is simply THE runtime; stop treating
  fallback tiers as a live concern unless the distribution moves.
- **2026-07-29 — LD's biggest log family is now LD's OWN share-card telemetry, not crawler noise**
  (16,800 server warn rows/day = 48% of all rows). When house's ingest-suppression port comes up again,
  LD's correct first cut is coalescing `og_render_shed` into a periodic counter — not crawler filtering.
- **2026-07-29 — the server logs NO boot event.** No `server_started` anywhere in `hooks.server.ts` or
  `$lib/server/`, so deploy↔error correlation is reverse-guessed from client `app_version` first-seen.
  This also blocks the long-parked "deploy-settling error band" backlog item. Emit
  `{ app_version, commit, container: blue|green, is_standby }` once at boot.
- **2026-07-30 — the `/og` store is now disk → R2 → render, and there are THREE new things to read.**
  Deployed 09:12 UTC. (1) `og_card_served { source: 'disk' | 'r2' | 'render' }` is the denominator the
  endpoint never had — the honest verdict is *share of `/og` requests answered with the dictionary's own
  card*, not "% of renders that succeeded". (2) `og_remote_card_fault { operation, elapsed_ms }` means
  the R2 tier faulted; it is ALWAYS fail-open (the card just renders), so treat a low rate as noise and
  a sustained rate as "the tier is doing nothing". R2 itself answers in 36–231 ms from the box, so a
  fault with `elapsed_ms` near the 2,000 ms deadline means the PROCESS was busy, not R2. (3) The disk
  caps went 1,000 → 5,000 entries / 250 MB → 1 GB, so `og_render_shed` should fall a long way even
  before the bucket exists. ⛔ **`livingdictionaries-og-cache` does not exist yet — Jacob must create
  it** (the app's R2 token is object-scoped: 403 on CreateBucket, verified). Until then every R2 GET is
  a clean 404 miss and `source:'r2'` will never appear.
- **2026-07-30 — the render-pool timeout was 20 s measuring the WRONG THING; it is now 10 s measuring
  the right one.** The pool used to post every job at once and start each job's clock at POST time, so
  concurrent callers timed each other out — a queue length reported as a wedged renderer. It now
  dispatches one job at a time with the clock starting at hand-over. **Watch `og_render_worker_timeout`
  on the next review**: baseline was 2 events in a 45-minute window at 20 s (i.e. real wedges existed
  before this change). If the daily count rises materially, raise LD's bound toward 15 s rather than
  reverting the dispatch change — LD's worker fetches Google Fonts INSIDE the render (up to 2 × 3 s),
  which house's does not.
- **2026-07-30 — `og_render_failed` now carries `script` / `family` / `timed_out`.** The 07-29 "1,536
  font failures = one Arabic dictionary" finding had to be reached by hand; it is now a group-by. Use it
  to size `.issues/bundle-render-fonts.md` (filed in LD and house) before choosing which faces to bundle.
