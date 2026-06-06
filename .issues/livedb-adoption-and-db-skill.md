# Adopt the reactive LiveDb (mutate-then-`_save`) model in Living + DB-skill cleanup

Context: post Supabase→SQLite cutover, per-dict content now lives in the browser
`DictLiveDb` (reactive rows with `_save`/`_reset`/`.update`/`.insert`) — the same
proven model tutor uses. But the entry UI doesn't take advantage of it yet: it
renders a **denormalized `EntryData` read-model** (assembled by `init_entries` from
`read_dict_bundle`, kept fresh by `orama-watcher`) and writes through a
`dbOperations` → `operations.ts` wrapper that manually stamps the editing user.
The render-object and the write-object are different — so you can't "mutate the
row you see and hit save."

Decisions (interview with Jacob 2026-06-06):
- Q1 ✅ Add `user_id` to `DictLiveDb` so save/insert/update auto-stamp
  `created_by_user_id` / `updated_by_user_id`. This is THE enabler.
- Q2 ✅ Pilot mutate-then-save on scalar entry/sense fields off live `dict_db`
  rows; leave media/sentences/junctions on the read-model. Plan the rest for later.
- Q3 ✅ Keep `dbOperations` thin for genuinely multi-table ops; single-row scalar
  edits call `dict_db` directly. Long-term: push more into the UI unless an
  abstraction removes real repetition.
- Q4 ✅ This session: skill update + safe cleanups + enabler + ONE-field pilot.

## This-session checklist
- [x] Enabler: `create_dict_live_db(conn, { user_id })` + `set_user_id()`; auto-stamp
      audit cols in `#insert` / `#upsert` / `#update` / `#save_cb` (only for syncable tables, only when a user_id is set).
- [x] `+layout.ts`: pass `user_id: auth_user.user?.id` at construction and
      `dict_db?.set_user_id(...)` every load (handles login/logout while a dict is open — the dict_db is cached on globalThis and survives invalidation).
- [x] Simplify `operations.ts`: dropped manual audit-stamping (enabler handles it),
      modernized `get(page)`→`$app/state`. KEPT `clean()` (see note) + the
      signed-in guard + multi-table orchestration.
- [x] Remove the 4 `console.info({...})` debug logs in `entries-ui-store.ts`
      (they logged the ENTIRE entries map — 50k+ rows on big dicts).
- [x] Pilot: entry detail `phonetic` field renders off `dict_db.entries.id(entry.id)`
      and saves via `entry_row._save()` (`save_phonetic` in EntryDisplay.svelte).
- [x] Rewrite the Living `database` skill: removed stale refs (the gone AGENTS.md
      "Live PGlite" section, `/test/dict-sync`, `.knowledge/architecture|decisions`),
      added the full LiveDb/DictLiveDb API mapping + the read-model caveat + auto-stamping.
- [x] Verify: `pnpm --filter=site check` (0 errors, no new warnings), `test --run`
      (369 pass), `build` (✔), `node build` boot + curl `/about` + `/<dict>/entries`
      + `/<dict>/entry/<id>` all 200.
- [ ] **Jacob to verify in the browser**: edit `phonetic` on an entry → saves +
      persists + re-indexes; spot-check a couple other dbOperations edits (add tag,
      edit a gloss) still work after the `$app/stores`→`$app/state` swap in operations.ts;
      confirm `updated_by_user_id` is stamped (sqlite-query the live dict.db).

## NOTE: `clean()` is NOT dead (revised from the interview)
`operations.ts` accepts the **legacy** Supabase types (`TablesUpdate`/`TablesInsert`
from `src/lib/types/db.ts`), which still carry `created_by` / `updated_by` /
`dictionary_id`. `clean()` strips those legacy columns before writing to the new
dict.db schema (`created_by_user_id` / `updated_by_user_id`, no `dictionary_id`).
Removing it safely requires moving the operation signatures onto the Drizzle dict
types (`DictUpdateType<'entries'>` etc.) — a bigger, rippling change. Keep `clean()`
this session; logged as longer-term below.

## Longer-term (separate issues / piece-by-piece) — the rest of the move
1. **Move entry-detail scalar fields off the read-model.** After the phonetic
   pilot, convert lexeme/orthographies/notes/morphology/interlinearization/
   scientific_names/elicitation_id (entries) and glosses/parts_of_speech/
   semantic_domains/noun_class/plural_form/variant/definition (senses) to render
   + mutate + `_save()` off `dict_db.entries.id()` / `dict_db.senses.query()`.
2. **Decide the read-model's future.** It's still needed for Orama search + the
   list/gallery/table/print views + SEO. Options: keep it purely as a
   search/list index and let detail/edit screens read live rows; or make the
   read-model itself LiveDb-derived. Needs a design pass.
3. **Retire the legacy `TablesUpdate`/`TablesInsert` (`types/db.ts`) on the write
   path**, switch `operations.ts` to Drizzle dict types, then delete `clean()`.
4. **Media/sentences/junctions**: keep the thin multi-table ops; revisit whether
   any can become direct UI calls once the row-level model is the norm.

## Test results (2026-06-06) — codified in `e2e/db-ops-flow.mjs` (`pnpm -F site test:db`)

**`pnpm test:db` → PASS, 16 checks** against the running `pnpm dev` (3041), logged in as
the seeded NON-admin `achi-manager@example.com`, verified against the REAL server SQLite:
- G1 logged-out read-only · login non-admin manager · G2 can_edit + 13 entries.
- **B1–B4 audit auto-stamping (THE ENABLER):** insert stamps created_by+updated_by=MOCK_USER_ID
  +dirty+auto-uuid; update stamps updated_by, bumps updated_at, keeps created_by; upsert stamps
  updated_by; junction (entry_tags) stamps both + dirty.
- **F sync round-trip:** dirty rows pushed to `.data/dictionaries/achi.db`, dirty cleared by id,
  server row carries the stamped editor.
- **D phonetic pilot:** live-row mutate+`_save()` wrote dict.db + stamped editor; UI reflected it;
  persisted across reload (server SQLite).
- **C dbOperations over `$app/state`:** insert_sense + delete-sense via UI worked at RUNTIME —
  validates the `$app/stores`→`$app/state` swap (the one change I couldn't statically prove).
- E read-model rebuilt to 13 after the churn. No uncaught page errors. Net-zero (achi left clean).

**`pnpm test:flow` (existing achi-flow) → PASS** against 3041 — my changes don't regress the
existing editor flow. **`pnpm test:media` → PASS** (presigned-PUT intercept → photo+audio rows
persisted to real server SQLite w/ serving_url + storage_path → fresh render; validates the media
insert ops I simplified). **`pnpm check` 0 errors** with the restored seed script.
(achi.db left clean: 13 active entries, `e_ja`=`haʔ`, no ZZ/mock leftovers.)

Tooling restored/added: `scripts/seed-achi-fixture.ts` (self-contained, seeds the non-admin achi
manager role into shared.db — achi.db already holds the `e_*` fixture) + `seed:achi-fixture` /
`test:db` package scripts.

Deferred (adjacent, not this change): the dbOperations media/sentence/dialect/speaker ops via UI
(underlying LiveDb writes + stamping are covered); the `dev_admin_level` admin-path + viewer-write-
rejected gating; catalog (shared.db via API). Sync-engine delete/tombstone propagation timing is a
SEPARATE pre-existing concern (auto-sync can pull-resurrect a locally-deleted row before its
tombstone reaches the server) — surfaced during testing, out of this change's scope.

## Browser test plan (DB operations) — to execute after prereqs are met

Driver: puppeteer-core via the browser-tools `launch()` (same as `e2e/achi-flow.mjs`).
Test dict: **achi** (13 entries, 15 senses, 2 speakers, 2 audio, 1 photo, 2 dialects,
2 tags; 0 sentences/videos/texts — created during tests). Codify as `e2e/db-ops-flow.mjs`.

### A. LiveDb/DictLiveDb primitives
- [ ] `.rows` / `.objects` / `.id(id)` reactivity; `.find(id)` async; `.loading`.
- [ ] `.query({where,params,order_by,limit,offset})` + `.snapshot()`.
- [ ] `insert()` single + batch(savepoint) + auto-uuid; `upsert()`; `update({id})`; `delete()`→`deletes`.
- [ ] Row `_save()` persists a mutation; `_reset()` discards+reloads; `_delete()` soft-deletes.

### B. Audit auto-stamping (the enabler — core change)
- [ ] `insert` stamps `created_by_user_id` + `updated_by_user_id` = current user.
- [ ] `update` stamps `updated_by_user_id` (when caller omits it).
- [ ] `_save()` FORCE-restamps `updated_by_user_id` to the current editor; leaves `created_by_user_id`.
- [ ] `upsert` stamps both when absent. `dirty=1` + `updated_at` bumped on every write.
- [ ] `set_user_id` refresh: edit as user A → `created_by`=A; re-auth as user B, edit same row → `updated_by`=B, `created_by` still A.
- [ ] Not-signed-in → operations guard throws "must be signed in" (no NOT NULL crash).

### C. operations.ts (dbOperations) — every op post-simplification + `$app/state` swap
- [ ] insert_entry (entry+sense, navigates); update_entry (each field) + soft-delete.
- [ ] insert_sense / update_sense (gloss, POS, semantic_domains, noun_class, plural_form, variant, definition) / soft-delete sense.
- [ ] insert_sentence (sentence + senses_in_sentences) / update_sentence / delete_sentence (confirm).
- [ ] insert_audio / update_audio / soft-delete.
- [ ] insert_speaker; assign_speaker audio link+remove; assign_speaker video link+remove.
- [ ] insert_tag; assign_tag link + REVIVE soft-deleted + remove (`link_junction` revive path).
- [ ] insert_dialect; assign_dialect link+remove.
- [ ] insert_photo (photo + sense_photos) / update_photo / soft-delete.
- [ ] insert_video (video + sense_videos) / update_video / soft-delete.
- [ ] **HIGH-RISK**: confirm `$app/state` page read works at RUNTIME for every op (no crash) — this backs all edits.
- [ ] "Wait until loading spinner stops" guard fires when `entries_data.loading`.

### D. The pilot (phonetic mutate-then-save off the live row)
- [ ] phonetic renders from `entry_row?.phonetic ?? entry.main.phonetic`; edit → `save_phonetic` mutates+`_save()`.
- [ ] UI updates (live row + read-model via orama-watcher); persists across reload; `updated_by_user_id` = logged-in user.

### E. Read-model ↔ LiveDb consistency
- [ ] dbOperations write → orama-watcher re-indexes → EntryData read-model updates in list/gallery/table/detail.
- [ ] Pilot live-row write → same propagation. Orama search reflects edited lexeme/gloss.

### F. Sync round-trip
- [ ] dirty=1 in browser dict.db after edit (sqlite-query); `sync_now` → server `.data/dictionaries/achi.db` updated; dirty cleared by pushed id.
- [ ] Reload (snapshot+changes) → edits persist; soft-delete tombstones sync; **junction sync** (assign tag → sync → reload → persists).

### G. Permissions / auth gating
- [ ] Logged-out → read-only (no affordances). Non-admin manager → can_edit + server verify passes. Site-admin via `dev_admin_level` → can_edit. Viewer (no role) → write rejected server-side.

### H. Media (DEV-mode only — dev-media mock; needs `pnpm dev`, NOT `node build`)
- [ ] Upload image/audio/video → dev-media PUT stores `.data/dev-media/...`, displays/plays; pulled photo (lh3) real, pulled a/v → dummy.
- [ ] insert_photo/audio/video rows + junctions; assign_speaker to media; soft-delete media.

### I. Catalog (shared.db via API, not LiveDb)
- [ ] Dictionary settings/about/grammar update via `api_dictionaries_catalog` → shared.db → invalidate → UI.

### J. Regression — existing e2e suite all green after my changes
- [ ] test:flow, test:sync, test:entries, test:catalog, test:media, test:watch.

## Prereq status (verified 2026-06-06)
- ✅ Media-mock static placeholders + `/api/dev-media` route present. dev-media is **DEV-gated** (`import.meta.env.DEV`) → media tests REQUIRE `pnpm dev`, not `node build`.
- ✅ achi.db content present (gaps: 0 sentences/videos/texts — created in tests).
- ❌ **Living dev server NOT running.** Port 5000 = HOUSE; Living 3041/3042 = connection refused. Jacob must start Living `pnpm dev` (3041).
- ⚠️ **achi-manager fixture role clobbered** by the full prod-catalog pull. `seed:achi-fixture` no longer in package.json. Real achi managers now: `annaluisa@livingtongues.org`, `diego@livingtongues.org`. Plan: log in as a real manager via dev inline-OTP (no re-seed needed) + `dev_admin_level=1` for the admin path.
- ⚠️ Testing mutates `.data/dictionaries/achi.db` + `.data/dev-media` (dev data; net-zero create/delete where possible).

## Verification gotchas
- No client-side `DictLiveDb` unit harness (needs the SharedWorker) — rely on
  `pnpm check` + browser. Stamping can be spot-checked via the `sqlite-query`
  skill against the live browser dict.db (dirty rows + `updated_by_user_id`).
