# Executing the approved 2026-07-26 overnight items

Sources: `~/code/horse/.cron/overnight-briefs/2026-07-26.md` (agenda 4, 5, 11, 12, 14) ·
`.cron/log-reviews/2026-07-26.md` · `.issues/og-share-image-webp-regression.md` ·
`.issues/analytics-compute-blocks-server.md` · `.issues/yokoim-dirty-rows-stuck-2026-07-20.md`.

**Everything stays UNCOMMITTED — Jacob owns every commit (push = deploy).**
The tree already carried the parity-sweep snake_case rename (7 exported names, 15 files) before this
work started — leave it alone.

## Tasks

- [x] ✅ 1. Photo-less share cards (satori/WebP)
- [x] ✅ 2. Analytics freeze — port house's built fix
- [x] ✅ 3. Converge the watermark SWR cache across all three repos
- [x] ✅ 4. Analytics must never block a request path
- [x] ✅ 5. Phantom unsaved flags — cleanup + server normalization + telemetry
- [x] ✅ 6. Stop booting the offline DB for robots (measure, then gate)
- [x] ✅ 7. Small fixes: `audio.play()` catch + user feedback; redundant `sources` in entry patch
- [x] ✅ 8. Unguarded-promise audit (report, fix only trivially safe)
- [x] ✅ 9. Append standing decisions for 2026-07-27

## 1 — Share cards: the satori version check (DONE, answer is NO)

Measured on this machine, not assumed:

| chain | `data:image/jpeg` | `data:image/webp` |
|---|---|---|
| satori **0.0.44** (LD today) + resvg-js 2.2.0 | renders | silently blank / `Unsupported image type` on a remote URL |
| satori **0.29.0** (latest) + resvg-js **2.6.2** (latest) | renders | **still blank** |

satori ≥ 0.26 does *parse* WebP (it's in `ALLOWED_IMAGE_TYPES` and it sizes the file), so it stops
throwing — but satori only ever emits an `<image href="…">` into an SVG. The rasterizer is
**`@resvg/resvg-js`, and 2.6.2 (the newest release) cannot decode WebP** — a direct
`<image href="data:image/webp…">` renders fully transparent. So a version bump does NOT fix this; it
would only convert a loud failure into a silent one (worse: no `og_render_failed` row at all).

→ Fall back to feeding `/og` a format the chain can decode. Chosen: **transcode server-side in the
`/og` route** (option C in the issue) rather than pointing the card at the original (option A) or
adding an `_og.jpg` variant (option B), because it is the only one that is immune to the NEXT format
migration (AVIF/HEIC), needs no backfill, and keeps the small WebP download.

### What landed (task 1)

- `site/src/routes/og/card-image.ts` (new) — `is_decodable_by_card_renderer()` (pure, unit-tested)
  + `card_image()`: pass a decodable URL straight through (no fetch, no CPU), otherwise fetch it
  with a 6 s timeout, sharp-transcode to a JPEG **cover-cropped to the exact card size**, and return
  a data URI + its dimensions. Any failure → `null` + an `og_image_transcode_failed` warn, and the
  card renders photo-less exactly as before. 25-entry memo keyed by `WxH|url`.
- `/og/+server.ts` — runs `card_image` before rendering; an unobtainable photo now goes straight to
  the globe card instead of burning two doomed renders reaching the text-only fallback.
- `OpenGraphImage.svelte` — new optional `image_width`/`image_height` rendered as `<img>` attributes.
  **satori cannot measure a data URI** ("Image size cannot be determined") — that is why the first
  attempt rendered a photo-less card even after the transcode. Also swapped the photo's
  `width/height: 100%` for explicit px: satori resolves a percentage against the parent's CONTENT
  box, so the photo had always stopped 96×72px short of the card edges.
- Verified end to end against the running dev server: `/achi/entry/e_ja` → its real `og:image` URL →
  a 1200×630 PNG with the photo full-bleed behind the title (`/tmp/og4.png`).


## 2 + 3 + 4 — the analytics freeze, the converged cache, and "never block"

**Convergence:** the tutor worker had ALREADY landed a converged `watermark-swr-cache.ts` while my
proposal was in flight, so LD adopted **tutor's file verbatim** (only the app-specific doc lines
differ) rather than re-litigating names — highest convergence, least churn. Coordination messages
went to both sibling workers (house `223bf736`, tutor `6dc0a9f9`): the shape, the supersede, and the
defect below. Canonical shape now in LD:

- `get_or_schedule` (sync) · `get_or_schedule_async` · `refresh_async` · `settle()` · `clear()` ·
  `size`; options `{ read_watermark, on_background_error, schedule?, persistence? }`;
  `compute({ reason })`; persistence `{ load, save, remove? }`;
  **watermark read BEFORE the compute** everywhere.
- `watermark-swr-cache.test.ts` is the union suite (23 tests) — plus one NEW case below.

**Defect found + fixed during the port (all three repos have it):** `#schedule_async_refresh`
captured no generation, so `#run_compute` read `this.#generation` when the refresh *started running*.
A `clear()` landing between "stale read schedules the refresh" and "the refresh runs" was invisible
to the guard and the invalidated result repopulated the cache **and its durable file**. The sync path
was already correct. Fixed by passing the schedule-time generation through; LD's app-level
`log-analytics-cache` suite is what caught it. Reported to house + tutor with the patch and the test.

**Ported into `log-analytics.ts`:**
- `$lib/server/breathe.ts` + a `stage({ timings, label, run })` runner replacing `timed()` — 25 call
  sites. Every stage now yields the event loop first and ALWAYS records its cost (the per-stage map
  used to exist only behind `ANALYTICS_PROFILE=1`).
- `stages` now rides `admin_analytics_computed` (closes coverage gap §5.3).
- `watermark-cache-file-store.ts` persistence under `DATA_DIR/analytics-cache/*.json`, format
  version 1 — **bump `ANALYTICS_CACHE_FORMAT` whenever the `LogAnalytics` shape changes.**
- `get_log_analytics` is now **async** and single-flighted on the cold miss (callers updated:
  `/api/admin/analytics`, both test suites).
- The distinct-user-agent scan is now a recursive **index jump-scan**
  (`query_distinct_window_user_agents`) — house measured the identical rewrite at 6,756 ms → 3 ms,
  and LD's `logs.db` is 2.0 GB vs house's 1.4 GB.
- **Warm off the request path** (task 4): `warm_analytics_caches()` runs from the retention cron's
  new `after_sweep` hook (the sweep is what advances the watermark, i.e. the moment everything goes
  stale) and, 30 s after boot, via `start_analytics_warm_up()` from `hooks.server.ts`.

**Task 4 audit — where else does telemetry work run synchronously in a request?** After this port,
nowhere heavy. `/api/admin/analytics` was the only request path doing whole-table `client_logs`
scans. `/api/admin/storage` aggregates the bounded `media_objects` ledger + `media_storage_daily`
rollups; `/admin/sync`, `/admin/dictionaries` and the schema graph read indexed/paginated rows;
`insert-client-log` is one indexed INSERT. The remaining exposure is a cold miss with **no** persisted
payload (a brand-new volume) — still in-request, but now single-flighted and stage-chunked.

New tests: cold-miss single-flight, disk mirroring, warm-up arms every landing key, and an explicit
**event-loop yield** test (a `setImmediate` queued when the compute starts must run before it
finishes — that is precisely what the 502s proved was impossible before).

## 5 — Phantom unsaved flags (cleanup + prevention + telemetry) ✅

Full detail in `.issues/yokoim-dirty-rows-stuck-2026-07-20.md`. Headline: the SOURCE turned out to be
`$lib/db/server/dedup-labels.ts`, a server-side maintenance job that minted junction rows with
`dirty = 1` — the exact "bulk, junction-only, never content" signature. Fixed at the source, on merge,
on pull, and in the snapshot copy; **5,437 production rows across 33 dictionaries cleared** (backed up,
transactional, FK-clean, re-scan `affected: 0`), all 33 snapshots rebuilt and verified from the public
R2 object. `dirty_rows_stuck` now carries `{ tables, has_editor_role, oldest_dirty_updated_at }`.

Related finding logged but NOT changed at the time: the same class exists in `shared.db` (351 rows),
where server code sets `dirty = 1` deliberately — needs one decision, not a copy of tonight's fix.

### The shared.db decision — RESOLVED 2026-07-27 ✅

The "is it load-bearing?" question dissolved under evidence — it is **inert**, on three independent
counts:

1. **Pulls ride `server_seq`, not `dirty`.** `fetch_changes` filters `WHERE server_seq > cursor`, and
   the `20260709` triggers assign a fresh seq on EVERY insert/update. A plain `UPDATE` propagates.
2. **The admin client nulls it on arrival** — `sync/engine.svelte.ts` sets `row.dirty = null` on every
   pulled row (readonly tables: deletes the key) before upserting.
3. **The server never reads it,** and the shared merge path already excludes `dirty` from pushed
   columns, so a canonical row can only get flagged by LD's own route code.

The ~10 route comments claiming "sets `dirty = 1` so the admin.db sync engine pulls the change" were
therefore simply **wrong** — and the database skill's ops rule #2 was propagating the error to
operators doing live DB surgery.

Landed (all uncommitted):

- ✅ Dropped `dirty` from every server-side shared.db write — `gloss-languages.ts`, `orthographies.ts`,
  `catalog`, `roles`, `invites/[invite_id]`, `invites/[invite_id]/accept`, `partners` (×3),
  `dictionaries/create` (×2), `email/invite` (×2), `admin/match-thread-to-user` (×2),
  `admin/dedup-labels`. Comments rewritten to state what actually propagates.
- ✅ Defense in depth: `normalize_server_dirty()` in `sync-helpers.ts` (mirrors the per-dict path),
  applied to the pull map + `echo_server_row`, so the 351 legacy rows can never be inherited as
  phantom unsaved work regardless of client version.
- ✅ Tests in `sync-helpers.test.ts` pinning BOTH halves (a flagless UPDATE still rides the pull
  because server_seq moved; a legacy `dirty = 1` row is served nulled). Both proven to FAIL when the
  fix is reverted.
- ✅ `gloss-languages.test.ts` asserted the old wrong behavior (`expect(row.dirty).toBe(1)`) — now
  asserts `dirty === null` plus a moved `server_seq`, i.e. the thing that actually matters.
- ✅ Database skill ops rule #2 rewritten: bump `updated_at`, **never** set `dirty` server-side.
- ✅ **house parity**: it carried the identical two statements in its own
  `admin/match-thread-to-user` (same file lineage, same wrong belief; its client nulls on pull the
  same way). Fixed + commented there too. tutor was already clean.

### The 351 production rows — CLEARED 2026-07-27 04:39 UTC ✅

Approved by Jacob. Ran to the skill's live-surgery shape (survey → backup → dry run → APPLY=1 → verify).

- **Survey** confirmed exactly 351, all `dirty = 1`, across 6 tables: `dictionaries` 195,
  `dictionary_partners` 79, `dictionary_roles` 56, `invites` 11, `message_threads` 9, `messages` 1.
  The newest was stamped **03:46 that morning** — proof the still-deployed old code was actively
  minting them.
- **Backup**: online-backup (`src.backup()`, zero downtime) →
  `/data/shared.db.bak-dirty-flag-clear-20260727-043827`, `integrity_check` ok, and confirmed to
  contain the 195 flagged `dictionaries` rows so a rollback is exact.
- **Script**: `/tmp/clear-dirty.js` — prints an `action | table | rows | new value` plan, opens the DB
  `{ readonly: true }` unless `APPLY=1`, writes in ONE transaction.
- **Result**: 351 cleared, **0 remaining**, `integrity_check` ok, `foreign_key_check` 0 violations,
  1,284 dictionaries intact.
- **`updated_at` was deliberately NOT bumped** — it is the LWW arbiter, and making these rows
  artificially "newer" could beat a client's genuine in-flight edit. Verified by ATTACHing the backup
  and diffing: `updated_at_drifted: 0` on every table, `rows_lost: 0`.
- `server_seq` advanced by exactly 351 (one per row), which is precisely what makes admin clients
  re-pull the now-clean rows — the mechanism the old `dirty = 1` writes wrongly took credit for.
- **Post-change health**: homepage + a dictionary page both 200; **zero** warn/error in the logs since
  the apply. The `sync_failed` events present are all `engine: dict` (per-dict network/client_behind
  noise, never the admin/shared engine) and all predate the change; `og_render_failed` is the WebP bug
  fixed tonight but not yet deployed.

⚠️ Until the code lands, prod keeps minting new ones — the count will creep from 0 on every catalog /
invite / role / partner write. Not harmful (they're inert), but the "clean means clean" signal only
becomes durable **after deploy**.

🔎 Found while verifying: `dirty_rows_stuck` is STILL firing from browsers that downloaded a poisoned
copy BEFORE last night's drain (server + snapshots are clean; the stale local OPFS copies are not).
Filed as `.issues/client-side-phantom-dirty-residue.md`.

## 6 — Stop booting the offline DB for robots ✅

### (a) The measurement — production, last 24h to 2026-07-27 03:21 UTC

| | boots | sessions | cold | warm | median cold snapshot | total cold snapshot bytes |
|---|---:|---:|---:|---:|---:|---:|
| **robots** | **1,476 (76%)** | 1,476 | 1,474 | 2 | **2.33 MB** | **6.32 GB** |
| humans | 467 (24%) | 448 | 187 | 280 | 2.29 MB | 0.70 GB |

**Robots are 76% of all dictionary boots and ~90% of all cold snapshot bytes — 6.3 GB downloaded in a
single day for nothing.** Effectively every robot boot is cold (1,474 of 1,476) and one per session:
a crawler never reuses an OPFS file. Humans are 60% warm. Sample rows are unambiguous — Googlebot
smartphone UA, `cold: true, storage: "opfs", snapshot_bytes: 1.3–8 MB`.

### (b) The gate

- `src/lib/server/is-bot-request.ts` (new, unit-tested) — wraps the ONE existing detector,
  `is_bot_user_agent`; no second helper. It adds only the two cases where a headless browser is a
  human's proxy: **dev**, and an **e2e run** (every LD e2e harness boots `node build` with
  `E2E_EXPOSE_OTP=true`, and puppeteer's UA says `HeadlessChrome`, which the detector correctly calls a
  robot — without this every e2e flow would silently lose its database).
- Root `+layout.server.ts` resolves `is_bot` once per request; the root `+layout.ts` re-exports it so a
  universal child can read it from `parent()`.
- `[dictionaryId]/+layout.ts` skips `get_dict_session()` entirely for a robot → no leader election, no
  worker, no OPFS snapshot download, no search index. Every consumer already handles a null session:
  that is the SSR path.

**Verified in a real browser against a production build** (`node build`, not dev):

| | `__ld_dict_clients` | `__ld_dict_connections` |
|---|---|---|
| Chrome UA | `['achi']` | `['achi']` |
| Googlebot UA | `[]` | `[]` |

And discovery is untouched — the robot's `/achi/entry/e_ja` HTML contains the lexeme `ja'`, the gloss
`water` and the full OG tags, and **after hydration the rendered page still shows them** (identical to
the human page minus the entry-count badge). Server-rendering the first page of the entries list stays
out of scope, as instructed.

## 7 — Small fixes ✅

- **(a) `audio.play()`**: new shared `$lib/media/play-audio-element.ts` emits `audio_play_failed`
  (`warn`) with `{ dictionary_id, entry_id, audio_id, storage_path, url, error_name, error_message,
  media_error_code, ready_state, network_state, online }` and lets the caller restore the truth. The
  entries `Audio.svelte` also **toasts the user** (`audio.playback_failed`, new EN key) — a silent
  failed tap is why those visitors tapped five times. Diagnosis itself waits for the enriched rows in
  production: per the standing 2026-07-14 rule, enrich first, never guess.
- **(b) redundant `sources`**: `ENTRY_PATCH_ARRAY_FIELDS` listed `sources`, so the patch path wrote a
  REPLACED value that the `merge_sources` block a few lines later immediately overwrote — dead work
  that read as if the two rules disagreed. Removed; 51 v1-entry-write tests still pass.

## 8 — Unguarded-promise audit ✅

Report: `.issues/unguarded-promise-audit-2026-07-27.md`. 10 findings; 8 fixed (all trivially safe —
every audio `play()` site now routes through the shared helper, plus `navigator.storage.persist()`),
2 recommended and left alone (Keyman writing-system load, orthography usage counts). It also documents
the sites that are FINE (everything through the `_call.ts` `{data, error}` pattern, the sync engines,
the Orama watcher) so the next sweep doesn't re-walk them.

## 9 — Decisions appended ✅

`.cron/log-reviews/decisions.md`, dated 2026-07-27: analytics/telemetry must never block a request path
(standing law), and the media-format → share-card rule (with the measured finding that a satori bump
does NOT fix WebP, so nobody re-tries it).

## Verification summary

`pnpm test` **2,101 passed / 3 skipped**, `tsc --noEmit` clean, `pnpm check` **0 errors**, `pnpm lint`
clean. Plus the live checks above: the rendered OG card, the prod-build robot gate in a real browser,
and the production DB scan/re-scan + the public R2 snapshot.

## Left for Jacob

Everything is **uncommitted** (including last night's parity-sweep snake_case rename, untouched). The
production data repair and the snapshot rebuild are already applied and cannot be un-deployed by
withholding the commit — the code fixes that PREVENT recurrence still need the push.
