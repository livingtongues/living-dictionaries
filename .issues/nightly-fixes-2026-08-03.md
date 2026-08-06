# Nightly fixes — 2026-08-03 (approved in the morning debrief)

Source reports: `.cron/log-reviews/2026-08-02.md` (§1.1–§1.5, §5.1),
`~/code/horse/.cron/journey-reviews/living-dictionaries-2026-08-02.md`,
synthesis `~/code/horse/.cron/overnight-briefs/2026-08-02.md` (conflict C1).

**All six items done. Everything left UNCOMMITTED for Jacob's review.**

Verification across the whole change: `tsc` clean · `pnpm check` **0 errors** (48 pre-existing
warnings, unchanged) · `pnpm lint` clean · `pnpm test` **341 files / 2560 tests passing**
(was 2549 — 21 new tests, 5 pre-existing assertions updated for the new return shapes) ·
headful-browser (xvfb) verification of items 1, 2 and 6 · svelte-look screenshots of the new
failure UI in light + dark.

## 1. ✅ Google Sign-In restored (C1)

- `$lib/auth/load-script-once.ts` — `crossorigin="anonymous"` was UNCONDITIONAL; now an opt-in
  `{ cors }` option (default off) whose doc comment carries the per-origin rule and the curl
  command to check an origin before enabling it.
- `AuthModal.svelte` — deleted the duplicate `<svelte:head>` GSI `<script>` tag. `display_one_tap_button`
  → `load_script_once` is now the single idempotent loader; the two used to race and execute the SDK
  twice (`.issues/google-one-tap-script-cors.md` asked for exactly this collapse).
- Rule recorded in `.cron/log-reviews/decisions.md` (2026-08-03 entry).

Origin headers checked, not assumed:

| origin | `access-control-allow-origin` | verdict |
|---|---|---|
| `accounts.google.com/gsi/client` | **absent** | attribute must stay OFF — it killed the button |
| `kit.fontawesome.com` | `*` | safe; `/admin/icon-review` keeps it |

**Before → after, measured in a real headful Chrome against dev:**

| | before | after |
|---|---|---|
| `gsi/client` network result | `net::ERR_FAILED` (CORS blocked) | **`200`** |
| `<script src=…gsi/client>` tags in the DOM | 2 (one with `crossorigin`) | **1, `crossorigin: null`** |
| `.google-button` contents | empty div | **Google iframe, 688 chars** |
| `window.google.accounts.id` | absent | **present** |
| Sign In dialog | orphan "OR" divider, no button | **"Sign in with Google" above the OR** |

Screenshot: `/tmp/ld-signin.png`.

## 2. ✅ Dictionary boot-failure ladder (§1.3)

(a) **Viewer recovery widened to the earlier door.** `poisoned_file_recovery_decision`
(`dict-instance.ts`) no longer refuses a fresh-file failure for viewers — `drop_in_snapshot`
swallows a failed write and falls through to an empty DB, so a quota blip leaves exactly the
half-file `sqlite3_open_v2` refuses. New reason `viewer_replace_fresh`, carried into
`dict_boot_file_replaced` so the branch's usefulness is measurable. The once-per-page-session permit
(`poison_recovery_attempted`, already carried across re-elections) is what prevents a loop.

(b) **Editors are asked, never silently reset.** `editor_preserve` is unchanged — an unopenable file
cannot be probed for un-pushed writes. Instead the failure panel shows editors an extra warning
paragraph and a `confirm()` before discarding.

(c) **A real failure state.** `dict-boot-progress.svelte.ts` gained `failure` +
`report_dict_boot_failed`; `routes/DictBootProgress.svelte` renders a card with **Reset and
re-download** + **Reload** and the raw `boot_message · last_stage`. Shown even when the bar never
activated (a warm re-open never emits `snapshot_fetch` — the shape every 2026-08-02 failure had).
New i18n keys under `misc.` in `en.json` only. New svelte-look flavors: `Failed_Viewer`,
`Failed_Editor`, `Failed_Viewer_Mobile`.

(d) **Bounds.** `boot-give-up.ts`: `MAX_BOOT_REELECTIONS` (3) caps the outer loop in `db-client.ts`;
`decide_boot_failure_log` caps rows per dict per page session (3 warn / 2 terminal, give-up always
emits). `will_reelect` + `reelect_attempt` added to `BootFailure`. `visibility` / `was_hidden` now
ride every row.

(e) **Storage diagnostics.** `boot-failure-context.ts` — `navigator.storage.estimate()` (quota,
usage, usage_pct) + `persisted()`, collected only on rows that actually ship.

**Before → after, e2e with the synthetic wedge harness (`__LD_DB_BOOT_FAULT__`, every boot throws):**

| | before | after |
|---|---|---|
| Anything on screen after the ladder | indeterminate bar, forever | **failure card at 32.6 s in dev** (~15 s in prod — dev pays vite worker-transform per spawn) |
| Boot attempts | unbounded (re-election reset the ladder) | **12, then stop** — verified nothing further spawns over +20 s |
| Telemetry rows for those attempts | 17 in one real session; 421 in another over 5 h | **6** (3 `leader_boot_failed` + 2 `dict_boot_recovery_exhausted` + 1 `dict_boot_gave_up`) |
| Storage/visibility in the row | nothing | `quota_bytes` 10,763,896,049 · `usage_bytes` 26,477,809 · `usage_pct` 0 · `persisted` false · `visibility` visible · `was_hidden` false |
| A way out | none | "Reset and re-download" → verified it destroys the client, drops the OPFS file, reloads, and logs `dict_boot_manual_reset` |

Screenshot: `/tmp/boot-failure-live.png`.

**NOT done (unapproved):** an in-memory fallback tier. Revisit only if re-fetch proves not to cure
these devices — next week's log review is the check, and `viewer_replace_fresh` +
`dict_boot_gave_up` + the storage numbers are how to read it.

## 3. ✅ Entries-list de-dupe (§1.4)

`$lib/utils/dedupe-entries-list.ts` (sibling of the entry-page `dedupe-keyed-children.ts`) runs ONCE
in `View.svelte` before all three views consume `entries`, and emits
`entries_list_duplicate_key { dict_id, dup_id, view, entry_count, query }`. The `<svelte:boundary>`
stays as the backstop. The warn is deliberately loud, per Jacob: if it ever fires with server-side
ids it stops being a corrupt-local-index story and becomes an editor-facing data problem.
Browser-verified: `/tutelo-saponi/entries` still renders 20 rows, no page errors.

## 4. ✅ R2 snapshot builder instrumented (§1.2, §5.1)

`run_r2_snapshot_sweep` now emits `snapshot_sweep_completed { dictionaries, bytes_uploaded,
duration_ms, step_ms, blocking_ms, slowest_dict, deleted, failed }`, at **warn** above
`SNAPSHOT_SWEEP_WARN_MS` (2 s), plus `snapshot_sweep_failed` on a throw. Before this the module had
**zero** `log_server_event` calls, which is why §1.2 could only *infer* the 6.4 s freeze from an
`:03`/`:33` timestamp.

`step_ms` keys: `reconcile · list_dirty · prune_deletes · backup · strip_and_bake · read_file · gzip
· upload`. `blocking_ms` sums only the SYNCHRONOUS ones — that is the number that maps to an
event-loop stall, and `strip_and_bake` is the freeze candidate the report suspected. An idle sweep
stays silent (this fires every 30 min and `logs.db` is 2 GB).

## 5. ✅ Retention sweep finished (§1.1)

- `rollup_day`'s single whole-day transaction is now **chunked at 500 rows**
  (`ROLLUP_WRITE_CHUNK_ROWS`, `write_in_chunks`), each per-table day-DELETE in its own statement. The
  child stops owning shared.db's write lock for seconds; §1.1 measured a 15.4 s hold and an 8.3 s
  event-loop stall with one signed-in user's 502 seven seconds before the sweep ended.
- **`shared.db`'s 5 s serving busy timeout was NOT touched**, per Jacob — dropping it converts waits
  into user-visible errors on a DB carrying request-path writes.
- The analytics/retention child now self-`ionice -c 3` (idle class) alongside its self-nice.
  `nice` governs CPU only, and the two longest steps are pure disk (`archive_old_logs` 20.6 s,
  `vacuum_logs_db` 40.0 s). Verified `ionice -c 3 -p $$` succeeds unprivileged inside the running
  **production** `sveltekit_blue` container (busybox provides `/bin/ionice`); entirely best-effort —
  a missing binary is a warn, never a failure.
- Tradeoff written into the code: a crash mid-rollup can now leave a PARTIAL day rather than rolling
  the whole day back. Both are healed the same way (drop the watermark row and re-run), and a new
  test covers a day wider than one chunk landing completely and re-rolling without doubling.

## 6. ✅ Dictionary directory searchable + sortable, names linked

`routes/dictionaries/filter-sort-dictionaries.ts` (pure, unit-tested) + a rebuilt `+page.svelte`:

- **Search** — diacritic-folding substring over name, url, **alternate names**, ISO 639-3,
  glottocode and location; every whitespace term must match ("odisha india"). Deliberately NOT the
  home page's fuzzy scorer: this view stays a full ordered table, so "rows containing what I typed"
  is the right contract. `alternate_names` added to the SSR row for this (searched, never displayed).
- **Sort** — all 8 columns, `aria-sort` on the `th`, arrow on the active one; blanks always sink to
  the bottom in BOTH directions (sorting by ISO code to see who has one is useless otherwise).
- **Names are links** — to the dictionary home (or the legacy external URL, matching the URL cell),
  coloured as links. This column was inert text while the URL column carried the only link on the row.
- Result count `visible / total` shows only while filtering; the CSV export now exports **what you
  are looking at**.
- Unrelated bug fixed in passing: the rows were emitted directly under `<table>` with no `<tbody>`,
  which logged `node_invalid_placement_ssr` on every SSR render and risks a hydration mismatch.

Verified in a headful browser against a temporary 204-row dev catalog (seeded, screenshotted, then
deleted — dev `shared.db` restored to its original 6 rows): alternate-name search `kejom alt` → 8/204,
location search `cameroon` → 15/204, sort by entry count descending, mobile at 390 px, and a name
link navigating to the dictionary. Screenshots `/tmp/dir-{1..5}-*.png`.

## NOT approved this round (untouched)

- Deleting the 389 MB of stale `shared.db.bak-*` backups (Jacob left it unticked).
- Audio compression — separate planning session.
- An in-memory fallback tier for boot failure.

## Follow-ups worth a later pass

- `DictBootProgress.svelte`'s STAGE labels are still hard-coded English (pre-existing); only the new
  failure copy is i18n'd.
- The directory's search/sort state is component-local, not in the URL — deep-linking a filtered
  directory would be nice but interacts with `.issues/entries-q-param-and-leaked-query-param-state.md`.
- house's `db-client.ts` has the same unbounded re-election ladder; `boot_reelect_decision` is the
  port when its boot triage comes up.
