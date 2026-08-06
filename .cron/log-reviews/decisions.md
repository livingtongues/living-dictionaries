# Standing decisions — living-dictionaries log-review

Durable Jacob decisions this lane must honor. **Read this FIRST, before the dated digests.**

**Admission rule — the orphan test: a line belongs here ONLY if no other file could own it.**
A ruling of Jacob's, a standing policy, a known-noise classification, a triage rule — nothing else
owns those. A fact about code is owned by the code: cite the file, never copy the fact, because a
copy rots silently and nothing ever turns red. A measurement from one night is owned by that
night's dated digest. An open bug with an `.issues/` file is owned by that file. Write the reason
at the level of the CLASS, not the incident — a verdict closes one case, a rule closes all of them.
DELETE a line once its rule is obsolete. Keep it small — standing law, not a log.

- **2026-07-05 — `api/email/html/new-user-welcome.ts`: KEEP** even though it's orphaned — Jacob
  is handling welcome emails separately. Not a dead-file candidate.
- **2026-07-07 — the conlang fork is fenced off from mission reporting.** Don't count it or
  report on it.
- **2026-07-09 — stale-client `sync_failed` storms: IGNORE.** Greg's stuck tab is a forgotten old
  laptop (he's been nudged); **no forced-reload mechanism will be built.** Stale-tab/stale-build
  retry noise is KNOWN-NOISE — filter it from triage, stop re-raising it, drop the carried
  "stale-client recovery" coverage item.
  **NARROWED 2026-07-31** by the reload-once rule below, and only there: this still governs
  forgotten BACKGROUND tabs belonging to nobody's active work (a hidden tab is never reloaded
  behind the user — it waits for `visibilitychange`). The one carve-out is a FOREGROUND tab whose
  load can provably never succeed. Do not read the 07-09 decline as forbidding that.
  Do not re-triage individual stale-tab clients by name (Greg, Marlene, Evelyn, `river`, evelyn/
  solari) — they are all instances of this one class.
- **2026-07-09 — crawler noise:** `live_query_failed` proved 98.5% Googlebot; treat crawler
  misuse / bot boot-cascade rows as known-noise pending the fleet noise-floor artifact
  (worker `74d5d94a`). Same known-noise family: `[orama-watcher] delta scan failed`,
  `initial dict sync failed`, `Rejected` (serviceWorker.register — all anon/bot prerenderers),
  stale-build dynamic-import/CSS-preload 404s during blue/green swaps. **Also in this family
  (confirmed 2026-07-10 run 2):** `leader_boot_failed` (mostly anon/Googlebot, `will_retry:true`,
  "module script canceled" mid-boot + "disk image malformed" on bot OPFS) and `Failed to read dict
  bundle from wa-sqlite` (`sqlite_code:21 MISUSE`, `retried:true`) — both self-heal; don't re-triage.
- **2026-07-13 — `sync_failed` `kind:client_behind`/`schema_outdated` 409 on a live-session (non-null)
  tab is the SAME known-noise stale-build family** as the null-session zombies — a migration shipped and
  the old tab can't sync until reload. Already surfaced by `build_sync_health.stuck[]`. Don't re-triage
  individual stuck tabs; no forced-reload (07-09).
- **2026-07-14 — i18n missing-key warns (~800/day, mostly EN `ps.*`/`sd.*`) are non-canonical hand-typed
  POS/semantic-domain labels, NOT catalog bugs** — already surfaced on `/admin/analytics` missing-i18n
  panel (working as designed). Don't treat as an error or propose a panel. Only `gl.default`/he-type single
  keys are real `/translate` gaps.
- **2026-07-14 — NO wedged-client dashboard panels.** Jacob: "wedges are your job to find and fix, not
  mine to watch and observe in a dashboard." Stop proposing sync-halt / wedged-client indicator panels.
  Surface wedges as ACTIONABLE nightly-digest items (fix or human-nudge), not a dashboard to watch.
- **2026-07-16 — grammar `props_invalid_value` P3: NOT admin-3/preview-only; a real
  shared-editor bug, fix pending.** `GrammarSection.svelte` (`can_prose_edit`) opens `SectionEditor`
  in `prose_only` mode for any dictionary **manager** editing grammar intro prose, so it WILL hit a
  real-dict manager once they edit grammar; the only reason there is zero *mission* impact so far is
  that the observed users were on `bucket:"conlang"` dicts (fenced, 07-07). Root cause pinned:
  `SectionEditor.svelte` binds `draft_body[bcp]`/`draft_usage[bcp]` (undefined) into `MarkdownEditor`
  `value = $bindable('')`. Fix = drop the `''` fallback or pre-seed the key. Keep as a REAL P3, not
  preview-only. *(No `.issues/` file owns this yet — it stays here until one does.)*
- 2026-07-17 — **Free-form user-entered i18n values are DATA, not UI strings — render raw, no warn, no translation, no catalog promotion** (Jacob). Applies to custom semantic domains (`sd.*`, e.g. wenshanhua's 706 warns) AND free-form parts of speech (`ps.*`/`psAbbrev.*`, e.g. Italian `ps.v-è`/`psAbbrev.v-isce`/`psAbbrev.expr` on `1p-emanuscript`). These are NOT fill-translations gaps — the write path passes unknown values through verbatim by design. Code fix dispatched (living-dictionaries/f9fb21c3) to gate free-form values out of the missing-key i18n warn path entirely. STOP re-flagging these warns as actionable; do NOT propose promoting them into the en.json catalog (Jacob declined).
- **2026-07-22 — Dashboards favor interpretation and speed over raw inventories.** Minimize lists and contextless totals; maximize useful charts, trends, thresholds, comparisons, and action items. Treat fast initial load as product quality and defer low-value computation.
- **2026-07-22 — Svelte state must be de-proxied at structured-clone boundaries.** Any `$state` value sent to a worker or other structured-clone boundary must first become plain data with `$state.snapshot`.
- **2026-07-22 — `dict_boot_recovery_exhausted` on anon / webdriver / stale-bundle sessions is
  KNOWN-NOISE; only current-build SIGNED-IN rows are real.** Don't re-triage individual devices.
  (The open recovery work is owned by `.issues/dict-boot-persistent-opfs-recovery.md`.)
- **2026-07-26 — a `dirty_rows_stuck` row only deserves triage if the reporting user HOLDS a role on
  that dictionary.** Inherited server-side flags reach pull-only clients through the snapshot and warn
  forever; they are not lost user work. (The server-side population was cleaned up 07-27; the residue
  is client-local on stale tabs.)
- **2026-07-26 — when an error row cannot name what failed, ENRICH FIRST, then diagnose — never
  guess a fix blind.** Earned twice (waveform decode 07-14, `audio_play_failed` 07-26): both looked
  like codec bugs and both turned out to be something else once the row carried url / error name /
  mime / bytes / source. A rewrite of the log line is a legitimate first deliverable.
- **2026-07-27 — ANALYTICS AND TELEMETRY MUST NEVER BLOCK A REQUEST PATH (Jacob, standing law).**
  "Analytics are supposed to help me and speed me up, not slow me down… it shouldn't be blocking."
  Any admin/analytics/telemetry computation that is expensive is **precomputed, warmed off-request, or
  deferred** — never run synchronously in front of a user. When adding an analytics query, the question
  is not "is it fast enough" but "whose request pays for it" — the answer must be "nobody's".
- **2026-07-27 — CHECK THE SHARE-CARD PATH WHENEVER MEDIA FORMATS CHANGE (standing outbound rule,
  adopted fleet-wide).** An image-format migration silently breaks satori-based share rendering, and
  upgrading satori does not save you — satori only emits `<image href>`, and the rasterizer decodes a
  narrower set of formats than the app does. The durable shape is a format-agnostic `/og` that
  transcodes anything undecodable before rendering. Mechanism + the traps:
  `.knowledge/server/satori-fonts.md`.
- **2026-07-31 — never close a font finding on the absence of error rows: RENDER IT AND LOOK AT IT.**
  The 07-29 reading that Arabic cards "ship tofu" was wrong in the worst direction — they were
  serving the GENERIC card, because satori caches its FontLoader by the IDENTITY of `options.fonts`,
  so a `static_fonts_only` retry that reuses one array re-renders against the loader that just threw
  and fails identically. A subsystem can look quiet in the logs while every card is degraded.
  (Font-map mechanism and the verification method: `.knowledge/server/satori-fonts.md`.)
- **2026-07-27 — a 5-minute synthetic uptime probe CANNOT see a 1–3 minute outage** (LD reported 99.3%
  availability on a day with five total outages). Standing instrument rule: percentile/latency panels and
  5-min probes are the wrong tools for short total outages — user-observed 5xx (`sync_failed` `status`)
  is the honest availability signal. Broadcast to house + tutor; all three share the blind spot.
  **Proven twice** (again 08-01: the probe read 100% while signed-in users took 502s).
- **2026-07-30 — `/api/log` returns 200 for a supplied-but-INVALID server secret, so a remote prober
  cannot tell ingestion from silent rejection.** That is how 3,903 Mustang `uptime_probe` rows sat
  misattributed as `source='client'` for two weeks while every dashboard read empty and nothing
  warned. Standing instrument rule: an ingest endpoint that accepts a bad credential with a 200 makes
  its own feed unfalsifiable — when a panel is blank, check ATTRIBUTION before concluding "no data".
- **2026-07-27 (Jacob, OVERRIDES two prior standing decisions — now law) — robot classification is ONE
  canonical copy, adopted VERBATIM, guarded by a drift test.** The file is
  `site/src/lib/utils/bot-user-agent.ts` (byte-identical in house/LD/tutor; LD adopted house's copy
  2026-07-28), and LD's guard is `bot-user-agent.parity.test.ts`. What was endorsed is house's
  **precision**: word boundary on `bot|crawler|spider`, device-brand stripping (CUBOT is a phone), and
  `whatsapp` counting only without a `mozilla` token. **The two exports have opposite missing-UA policy
  — anything gating a whole app surface must use `is_bot_user_agent` (missing UA = human).** LD's
  dictionary boot gate hands a robot a null session, so failing closed there = a blank application.
  Don't re-propose per-repo matchers; don't "simplify" the two exports into one.
- **2026-07-28 — never move satori/resvg back onto the request thread.** Worker isolation is what
  ended user-observed HTTP 502 sync failures; stop re-verifying that it worked.
- **2026-07-28 — two standing lessons about synchronous work on a single thread**, both measured
  here and both counter-intuitive: **a concurrency limit alone is nearly a no-op** (a burst arrives
  as a backlog, not as concurrent handlers), and **a microtask slot-handoff makes starvation WORSE**
  (hand off with `setImmediate`). Full writeup, with the numbers:
  `.knowledge/server/synchronous-work-on-the-request-thread.md`.
- **2026-07-28 — `audio_play_failed` separates expected control flow from a real object fault.**
  An `AbortError` saying `play()` was interrupted by `pause()` is expected tap/close behavior and
  should NOT warn. `NotSupportedError` + media error code 4 remains actionable — inspect the object's
  bytes / headers / codec before proposing a player fix.
- **2026-07-28 — when work moves OFF the request path, its cost telemetry must move with it
  (generalized lesson, broadcast to house + tutor).** An event emitted only from the request handler
  makes the warm path invisible; add a `trigger` field rather than a second event. **Never read
  "no events" as "no computes".**
- **2026-07-29 — a card store with NO hit-rate telemetry looks healthy while thrashing (standing
  instrument rule, fleet-wide).** If the endpoint returns a stored card without telemetry, its
  denominator is unknowable and a "success rate as % of attempts" panel reads ~96% on a night when
  most shares served the generic card. **Never compute a health line from failures alone** — one
  request can emit several through a fallback ladder. Build the numerator AND the denominator.
- **2026-07-29 — the `db_tier` mix is THE runtime, not a live concern.** Humans are 100%
  `opfs-worker`; the `idb-worker` residue is Applebot. **Bot-filter before reading the `db_tier`
  distribution as a capability regression**, and stop watching fallback tiers unless the human
  distribution moves.
- **2026-07-30 — the daily analytics checkpoint's ONLY silent failure mode is "it stopped being
  written". Assert every run:** an `analytics_snapshot_computed` less than 26 h old, `failed: []`,
  and `reason` = the cron rather than `boot-catchup`. Only re-report on failure.
- **2026-07-30 — a shedding cache FEEDS ITSELF (mechanism worth remembering fleet-wide).** A shed
  response carries a short `max-age` while a real one is immutable-for-a-year, so while most
  responses are sheds the edge caches nothing and the same scrapers return every minute. Fixing the
  store's capacity cut total `/og` request volume ~100×, not just the miss rate. Read a shed rate as
  a *demand amplifier*, not only as a quality loss. Corollary: once the store is big enough,
  `og_card_served source:'r2'` reading ZERO is CORRECT, not a bug — the disk tier never evicts at
  that volume, so R2 is never consulted. Don't re-report it as a broken tier.
- **2026-07-30 — treat any 5xx OUTSIDE a deploy window as a new incident.** The post-fix baseline is
  that every 5xx is deploy-shaped; that is what makes an off-window one meaningful.
- **2026-07-31 — THE RELOAD-ONCE RULE, approved portfolio-wide and SHIPPED in LD.** *When the missing
  thing is a build artifact the server has DELETED, retrying is provably useless — reload ONCE onto
  the current build instead of retrying N times.* `/_app/immutable/*` is content-hashed, so a 404
  there is permanent for that bundle. Earned on 07-29: a signed-in contributor was locked out of the
  private `algonquin` dictionary for SIX MINUTES while the app chased a deleted worker chunk 39
  times. Triage: `stale_bundle_reload` / `_deferred` / `_gave_up` are the terminal rows — **`_gave_up`
  is a real user stuck on a stale bundle, always escalate it**; a rising `stale_bundle_reload` count is
  just deploys working as intended. Apply the same shape to any NEW retry loop over a build artifact.
  The classifier correctly DECLINES storage faults it cannot fix — that boundary is deliberate.
- **2026-07-31 — A CLIENT-SIDE SELF-HEAL CAN NEVER REACH THE TABS THAT PREDATE IT (standing law,
  fleet-wide).** Every recovery mechanism ships INSIDE the bundle, so a tab open since before it
  shipped is running a version that contains none of it and will never heal — healing requires the
  one action it cannot take alone. **Corollary:** the residual population is never zero, IS
  enumerable, and belongs in the nightly digest as a human-nudge item (per the 07-14 no-wedged-panel
  ruling), never a dashboard. Regenerate it SERVER-side with: sessions having ≥10 `sync_failed` /
  `leader_boot_failed` / `dict_boot_recovery_exhausted` rows whose `app_version` predates the
  relevant fix. Don't propose a client-side fix for this population — nudge them, or add a
  server-side lever an OLD client already obeys.
- **2026-07-31 — `malformed_query_param` on key `q` is OUR bug, not user input** (the entries view
  registers `q` as a JSON object, so the guessable `?q=birthday` is silently replaced with `{}`).
  Don't re-triage the warning; the diagnosis and the `$effect.root` leak that duplicates it are owned
  by `.issues/entries-q-param-and-leaked-query-param-state.md`.
- **2026-07-31 — volume threshold: treat a return above ~50,000 log rows/day as a NEW event to
  investigate.** (Supersedes the 07-13 "100k+" threshold — the instrument now measures people, not
  robots, so the floor moved by an order of magnitude.)
- **2026-07-31 — with a once-daily checkpoint, the dashboards' newest day is ALWAYS frozen at
  ~03:30 Pacific.** Never read today's bar on `/admin/analytics` as a live number, and label it
  before anything else on that page.
- **2026-08-01 — every "Internal Error" LD serves is a STALE-BUNDLE NAVIGATION, not an SSR crash**
  (`origin:"client"` with a `Failed to fetch dynamically imported module` cause; zero server-origin
  rows). LD does not have an SSR-crash problem; it has a stale-tab-navigation problem. Don't
  re-triage individual `Internal Error` rows. The only open piece is COPY on `+error.svelte` (tell
  the tab to reload) — deliberately NOT a second auto-reload mechanism.
- **2026-08-01 — a checkpoint file whose payload says `reason:"verify-deploy"` is a HUMAN running
  the child by hand** (`docker exec -e ANALYTICS_SNAPSHOT_CHILD=1 …`), not a code path and not a
  silent recompute. Read `generated_at` + `reason` INSIDE the JSON before treating a fresh mtime as
  a telemetry gap.
- **2026-08-02 — MOVING A JOB OFF THE REQUEST THREAD IS NOT THE SAME AS STOPPING IT FROM BLOCKING THE
  REQUEST THREAD (standing law, fleet-wide).** Forking the work removes the in-process stall but the
  residual is CROSS-PROCESS: a child that writes a whole day in ONE transaction still blocks the
  serving process, which waits SYNCHRONOUSLY on the same database file. **The fix is chunked
  transactions in the child, NOT a smaller busy timeout** — unlike a droppable telemetry database,
  the shared database carries real request-path writes, so a short timeout converts waits into
  user-visible errors. Use `ionice -c 3` as well: `nice` is CPU-only and the longest steps are pure
  disk. house + tutor run the ported cron — broadcast when fixed.
  (Current status and measurements: `.issues/retention-sweep-blocks-request-thread.md`.)
- **2026-08-02 — an event-loop stall meter needs BOTH statistics: p99 AND max.** `loop_lag_p99_ms`
  never exceeded 13 ms on a day when `loop_lag_max_ms` hit 8,321 ms — a p99-only panel reads
  "perfectly healthy" during the exact minute a user is dropped. Never ship the percentile alone.
- **2026-08-02 — iOS/iPadOS OPFS boot failure is LD's top USER-FACING fault.** Two distinct gaps,
  both owned by `.issues/dict-boot-persistent-opfs-recovery.md`: nothing consumes
  `dict_boot_recovery_exhausted` (so the boot progress bar spins forever), and the give-up ladder is
  bounded WITHIN a worker but a re-election restarts it at zero. The reload-once rule correctly
  declines these — they are storage faults, not deleted build artifacts — so a human-readable failure
  state is the ONLY remaining lever. Don't re-triage individual devices; fix the two gaps.
- **2026-08-02 — a guard-log without its de-dupe is half a fix.** Shipping the telemetry that PROVES
  a caught `<svelte:boundary>` rendered nothing, without the one-line fix that stops it, means the
  next person still gets a blank results area — you just get to watch. Owned by
  `.issues/entries-list-duplicate-key-blank-results.md`; **08-03: the guard fired 3 more times and
  the duplicate is one level DOWN, in a nested keyed `each` inside `ListEntry.svelte` (prime suspect
  `{#each first_sense.semantic_domains as domain (domain)}`, keyed by the domain STRING). Don't
  re-verify the top-level de-dupe.**
- **2026-08-03 — `crossorigin="anonymous"` is a PER-ORIGIN decision, never a blanket one.** The
  attribute only de-opaques `Script error.` on an origin that actually returns a permissive
  `Access-Control-Allow-Origin`; on an origin that does not, it turns the load into a CORS request
  the origin refuses and **the script never loads at all**. Live proof: it was on
  `accounts.google.com/gsi/client`, which returns NO ACAO — so the Sign In dialog rendered an orphan
  "OR" divider with no Google button, and every Google user lost that path. REMOVED 2026-08-03
  (`$lib/auth/load-script-once.ts`, now `{ cors }` opt-in, default off). The standing "de-opaque the
  external scripts" item survives but is now **one origin at a time, each verified against
  that origin's real response headers first** (`curl -sI -H 'Origin: https://livingdictionaries.app'
  <url>`) — "add it everywhere" is the wrong reading and breaks more than it fixes.
- **2026-08-03 — `docker compose build` FREEZES THE SERVING CONTAINER**, up to 23.7 s measured, with
  the stall preceding `server_started` — it is the OLD container being starved by the build.
  `deploy.sh` runs a bare `docker compose build` with no CPU limit and no compose CPU reservation.
  **`nice` on the command is a no-op — the Docker daemon does the work, not the shell.** Levers:
  compose CPU weight for the serving containers, or a CPU-constrained buildx builder. Offer to
  house + tutor as a HYPOTHESIS to check on their own boxes (core count and build time differ), not
  as a port. *(No `.issues/` file owns this yet — it stays here until one does.)*
- **2026-08-03 — a boot-time job can hide inside a periodic one.** The "mystery freeze" was the
  snapshot builder's `reconcile_once_per_process()`: 18 of 21 sweeps block 19–130 ms, and the three
  that block 7–12 s are each the FIRST sweep after a container boot, 100% `step_ms.reconcile`. Fix =
  move it to the niced child or yield between the ~1,284 dictionaries. Don't re-derive.
  *(No `.issues/` file owns this yet — it stays here until one does.)*
- **2026-08-03 — the `20260728_repair_legacy_audio_paths.sql` client migration CANNOT MATCH the
  paths that are actually failing**, so the 07-29 "closed" verdict on `audio_play_failed` was wrong.
  Its filter `WHERE storage_path LIKE '%/audio/%/%'` requires a second slash after `/audio/`; the
  failing shape is `{dict}/audio/{entry_id}_{timestamp}.ext` (no second slash) — verified 0 vs 1 in
  SQLite. Its extension CASE also lacks `.mpeg` (would rewrite to `.wav`). Server DBs are clean and
  canonical URLs 200; the population is RETURNING anonymous visitors holding a pre-07-23
  browser-local copy — **the 07-23 migration rewrote the paths without marking the rows changed, so
  an existing browser never pulls the correction**, which is why only a client-side repair can reach
  them. *(No `.issues/` file owns this yet — it stays here until one does.)*
- **2026-08-03 — when a review changes how a THIRD-PARTY INTEGRATION loads, the acceptance test is
  that integration's own success metric (are people still signing in with Google?), never the
  absence of new error rows — a broken integration produces FEWER log rows, not more (standing law,
  fleet-wide).** Earned the hard way: Google sign-in was dead for THIRTY DAYS and 83% of all logins
  went with it, while this lane re-raised the same `crossorigin` item on EIGHT consecutive nights,
  each time verifying whether the change had been APPLIED and never whether the feature still
  WORKED. Evidence and day-by-day counts: `.cron/log-reviews/2026-08-03.md`. The law is about how you
  VERIFY a change, and it stands. **It is NOT a licence to build login alarms: Jacob removed the
  zero-logins alarm on 2026-08-05 and does not want to be notified about sign-in — do not re-file or
  rebuild it.** Its one and only firing was a substitution artifact (email read zero on 08-03 only
  because the restored Google path absorbed every login; it was back the next day). The
  `/admin/health` **Sign-in** panel stays as a plain logins-per-method chart you can go look at.
- **2026-08-04 (Jacob, morning debrief):** Audio derivatives are converted **on upload** — that is the
  real path. The derivative sweep is a **backfill only**: once daily, outside the web process. Do not
  propose returning it to a short interval or running it in the request-serving process.
- **2026-08-04 (Jacob, morning debrief):** iPhone **HEIC uploads are supported via a browser wasm
  decoder**, and the decoder must be **dynamic-imported only after a chosen file sniffs as HEIC** —
  a person uploading a JPEG must not download any of its ~1.5-2.5 MB. Server-side HEVC decoding was
  considered and declined.
- **2026-08-04 (Jacob, morning debrief) — "instrument first, THEN fix" is not a law; it applies only
  when the cause is unknown.** The 07-26 enrich-first rule above is scoped to *an error row that
  cannot name what failed*. When the mechanism is already established by READING THE CODE, ship the
  fix and the instrument in the SAME pass — sequencing them costs a day of degraded service to
  measure something already known. (Earned on the audio-derivative sweep: the report recommended
  instrument-first for a stall whose two causes — an unindexable computed-key join and 160 sync
  DB-file opens per run — were both visible in the source.)
- **2026-08-04 — a memo keyed by the FULL INPUT is a cache that can never hit (standing engineering
  rule, broadcast fleet-wide).** If the key contains something unique per request, the structure is a
  memory leak with a hit rate of zero, and it fails *loudly* only when the miss is expensive. Live
  proof: the share-card font-subset cache keys on `script|entire headword`, so every word missed and
  paid up to two 3 s Google Fonts round-trips against a 10 s render deadline — 13% of fresh cards
  timed out and served the generic card, concentrated on the dictionaries with rare letters. Key by
  the CLASS that recurs (here: the set of characters needing a fallback), never by the instance.
- **2026-08-04 — the residual old-tab population needs a SERVER-side lever, and there is one: stop
  deleting the previous build's `_app/immutable/` assets at deploy.** Follows the 07-31 law that a
  client-side self-heal never reaches tabs that predate it (proved again tonight: an Android tab on a
  07-24 bundle burned 92 minutes on a deleted worker chunk while the 07-31 reload-once fix sat in a
  bundle it will never load). Asset names are content-hashed, so merging the last build or two forward
  cannot collide; it costs disk and no client change, and it does NOT reopen the 07-09 no-forced-reload
  ruling. Prefer this over any new client mechanism for this class.
  **SHIPPED 2026-08-05** (`deploy.sh` → `/opt/hosting/immutable-archive`, Caddy archive-first). The
  standing part is the PREFERENCE: for the tabs a client-side self-heal can never reach, reach for a
  server-side lever an old client already obeys, not a new client mechanism.
- **2026-08-05 — A BUILD VERSION MUST BE UNIQUE PER BUILD, NOT PER COMMIT (standing engineering rule,
  broadcast fleet-wide).** Constancy *within* a build is only half the requirement; the other half is
  distinctness *between* builds, and nothing enforced it. Any image build that bakes something
  FETCHED AT BUILD TIME into the bundle (translations, homepage stats, remote config) makes two builds
  of one commit produce different content-hashed files under one version name — so the framework's
  update poll can never fire, the dashboard's current-vs-stale error split files stale errors as
  CURRENT, and a deploy leaves no marker on the timeline. Live proof: LD rebuilt `b4b47e55` on
  2026-08-05 and every asset hash changed while `app_version` did not. Fix shape: `${GIT_SHA}-${BUILD_ID}`
  with the build id exported once by the deploy script. Never read "same `app_version`" as "same bundle".
- **2026-08-05 — NEVER CLASSIFY AN OPAQUE LOAD FAILURE AS A CONTENT/BUILD FAULT WITHOUT RULING OUT THE
  NETWORK (standing triage rule).** A dropped connection and a deleted file produce the SAME bare
  browser event, and code that resolves the ambiguity "by construction" always resolves it toward the
  cause that is common in Boston — so the misdiagnosis lands on the far-from-origin user every time.
  Measured the same night in two subsystems: a Vietnam tab told "app update needed" for a worker chunk
  that exists on both containers, and an India tab told a valid, reachable-from-here MP3 was an
  unsupported format. The cure is one cheap probe on the failure path (URL + `navigator.onLine`, or a
  `HEAD`), and its absence is a coverage gap, not a style preference.
- **2026-08-05 — a probe that shares its failure path with the users cannot attribute the fault.**
  Narrower companion to the 07-27 rule about probe intervals: LD's uptime probe goes through Cloudflare,
  so when the edge↔origin link broke (42 user 520/522/525s while the box sat at 2–4% CPU) the probe
  failed too and no instrument could say whose fault it was. Any probe meant to answer "is it us?"
  needs a leg that bypasses the layer it is trying to exonerate.
