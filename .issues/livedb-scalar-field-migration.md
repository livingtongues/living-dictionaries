# Roll scalar entry/sense fields onto live-row mutate-then-`_save()`

Continuation of `.issues/livedb-adoption-and-db-skill.md` (the backlog). The `phonetic`
pilot proved the pattern; this rolls the remaining scalar entry/sense fields off the
denormalized `EntryData` read-model onto direct `dict_db` live rows. Read-model stays
for search + list/gallery/table/print + SEO.

## Context that changed since the backlog was written (IMPORTANT)
- The **hard-delete tombstone** conversion landed (uncommitted WIP; `.issues/dict-tombstone-path-incomplete.md`,
  CODE COMPLETE). `dict_db.delete()`/`_delete()` now `INSERT INTO deletes` → trigger hard-DELETE + FK
  cascade. The `deleted` column is GONE (`dictionary-migrations/20260606_initial.sql`).
- ⇒ This **resolves** backlog Q4(a) (tombstone pull-resurrection): the server trigger truly DELETEs,
  so snapshots are taken from a DB where the row is already gone. Nothing to resurrect.
- ⇒ The database SKILL.md (working tree) is now STALE — still documents `_delete()` as soft-delete via
  the `deleted` column. Must re-sync (Phase 5).
- ⇒ Three e2e harnesses still query the dropped `deleted` column → broken. (Phase 0.)

## Decisions (interview with Jacob 2026-06-06)
- Q1 ✅ Keep `EntryData` purely as the search/list index; detail/edit screens read live `dict_db` rows.
- Q2 ✅ Entry-level fields first → verify → then sense-level, all this session.
- Q3 ✅ Live-row ONLY for read AND save on the detail screen — drop both the dbOperations save-fallback
  AND the `?? entry.main.x` read-fallback. (Confirmed safe: `+page.ts` SSR is a "Loading…" placeholder
  and the client awaits the read-model load before mounting `EntryDisplay`, so the live single-row
  query resolves ~immediately; no earlier source to fall back to.) Browser-verify no field flicker.
- Q4 ✅ Retire legacy `TablesUpdate`/`TablesInsert` + delete `clean()` — but do it LAST, after the field
  migration is solid (don't overcomplicate the field work).
- Q5 ✅ Fix `achi-flow.mjs` to be net-zero/idempotent on `e_ja.phonetic`.
- Q6 ✅ Fix the stale soft-delete wording in `database/SKILL.md`.
- Surfaces ✅ (recommended "all"): migrate every scalar EDIT surface so `update_entry`/`update_sense`
  can actually be deleted — entry detail (EntryDisplay/Sense), table inline-edit (Cell.svelte, via
  `.update({id})` — no per-cell subscription), and entry coordinates (EntryMedia).

## Field inventory (all scalar columns; media/sentences/junctions stay on dbOperations)
- **entries** (`dict_db.entries.id(entry.id)`): lexeme + orthographies `lo1/lo2…` (MultiString),
  phonetic ✅, notes / linguistic_history (MultiString.default), morphology / interlinearization
  (string), scientific_names / sources (string[]), elicitation_id (string), coordinates (JSON, in EntryMedia).
- **senses** (`dict_db.senses.id(sense.id)`): glosses / definition / plural_form / variant (MultiString),
  parts_of_speech / semantic_domains / write_in_semantic_domains (string[]), noun_class (string).

## Edit surfaces (callers of update_entry/update_sense)
- `routes/[dictionaryId]/entry/[entryId]/EntryDisplay.svelte` (entry fields)
- `routes/[dictionaryId]/entry/[entryId]/Sense.svelte` (sense fields)
- `routes/[dictionaryId]/entries/table/Cell.svelte` (table inline edit, entry + sense)
- `routes/[dictionaryId]/entry/[entryId]/EntryMedia.svelte` (coordinates only)

## Save-handler shape (Q3 — live row only, no fallback)
```ts
const dict_db = $derived(page.data.dict_db)
const entry_row = $derived(dict_db?.entries.id(entry.id))
async function save_entry(mutate: (row: NonNullable<typeof entry_row>) => void) {
  if (!entry_row) return
  mutate(entry_row)
  await entry_row._save()
}
// handler: on_update={(v) => save_entry((r) => { r.notes = { default: v } })}
```
Reads switch to `entry_row?.notes?.default` etc. (drop `entry.main.*`). Same for `sense_row` in Sense.svelte.
Table (Cell.svelte) uses `dict_db.entries.update({ id, …patch })` (partial update by id — no `.id()`
subscription per cell) and keeps DISPLAY from the read-model.

## Phases (checkpoint each against `pnpm -F site test:db` + browser)
- [x] **Phase 0 — green the regression baseline** against the hard-delete schema:
  - [x] `e2e/db-ops-flow.mjs`: drop `AND deleted IS NULL` (line ~259); fix stale soft-delete comment (~208-212).
  - [x] `e2e/dict-sync.mjs:59`, `e2e/media-upload.mjs:84/85/96`: drop `deleted IS NULL`.
  - [x] Run `test:db` → GREEN (16 checks) BEFORE any field changes.
  - NOTE: first `test:db` run flaked with `net::ERR_ABORTED` on the first hit of `/achi/entry/e_ja`
    — that's Vite cold dep-optimization forcing a mid-navigation reload, not a real bug. Warm = fine.
- [x] **Phase 1 — entries scalar fields** in `EntryDisplay.svelte` (`save_entry` helper + live-row reads;
      inlined morphology/interlinearization; dropped `update_entry`/`TablesUpdate`/`EntryFieldValue`).
      VERIFIED: tsc 0 err/no new warnings · test:db 16 ✓ · screenshot all fields render · UI edit of
      Morphology round-tripped to dict.db w/ stamped editor + restored. Added retry-on-ERR_ABORTED
      `goto()` helper to db-ops-flow.mjs (Vite dev cold-start flake).
- [x] **Phase 2 — senses scalar fields** in `Sense.svelte` (`sense_row` + `save_sense` helper; dropped
      `update_sense`/`TablesUpdate`; reactive `dict_db`/`dictionary`/`dbOperations` via `$derived`).
      VERIFIED: tsc 0 err/18 warn (unchanged) · UI edit of English gloss wrote `{en:water-PH2,es:agua}`
      (preserved es) + stamped editor + restored · test:db 16 ✓.
- [x] **Phase 3 — table + coordinates**: `Cell.svelte` local `update_entry`/`update_sense` now persist via
      `dict_db.entries.update({id})` / `dict_db.senses.update({id})` (kept optimistic read-model mutation +
      read-model display); `EntryMedia.svelte` coordinates → `dict_db.entries.update({id, coordinates})`.
      VERIFIED: tsc 0 err/18 warn · table gloss edit (as Diego, 260 editable cells) wrote
      `{en:water-PH3T,es:agua}` + stamped Diego + restored. NOTE: surfaced a PRE-EXISTING keyboard race
      (`Keyman.svelte`/IpaKeyboard `firstElementChild` on a null `wrapperEl` when the edit modal is
      opened+closed faster than the keyboard's async `targetInput`/`waitForCKEditorToInitAndBeTargeted`
      interval) — unrelated to this change (fires before the save path; Phase 2's slower detail edit was
      clean). Filed: `.issues/keyman-keyboard-mount-race.md`.
      Dev OTP gotcha: `send-code` caps at 10 codes/email/hour (in-memory) — heavy manual re-runs against
      one email get rate-limited (verify 400). Use a second manager email (e.g. diego@livingtongues.org).
- [x] **Phase 4 (LAST) — retire legacy types + clean()**: deleted `update_entry`/`update_sense` +
      `clean()` + `SystemInsertFields`; converted the remaining ops onto Drizzle `DictInsertType`/
      `DictUpdateType`; dropped every `as never` cast (operations.ts + Cell + EntryMedia). KEY: `clean()`
      was already a NO-OP — `TablesUpdate`/`TablesInsert` are Drizzle-derived (`InferInsertModel<dict.*>`)
      since the Supabase-removal commit, so `clean()` stripped `dictionary_id`/`created_by`/`updated_by`
      that don't exist on the dict schema. Made `DictInsertType` auto-columns optional (`DictAutoColumn`)
      so inserts type-check without casts (matches the runtime auto-stamping). Updated `dbOperations.ts`
      barrel + `mocks/db.ts`. VERIFIED: tsc 0 err/18 warn (unchanged) · vitest 369 pass · eslint 0 err,
      0 NEW warnings (only pre-existing dict-live-db type-sig warnings) · `pnpm build` ✔ · test:db 16 ✓
      (insert_sense/delete_sense via rewritten ops) · test:media PASS (insert_photo/audio/assign_speaker).
- [x] **Phase 5 — docs + test coverage**:
  - [x] `database/SKILL.md`: soft-delete → hard-delete tombstone wording + read-model caveat rewritten
        to reflect the completed scalar-field migration (Q6).
  - [x] `achi-flow.mjs`: value-agnostic phonetic edit (idempotent) + net-zero restore of `e_ja.phonetic`
        with a server-file poll (Q5). test:flow PASS, fixture left clean.
  - [x] Updated `.issues/dict-tombstone-path-incomplete.md` (e2e now exercises hard-delete; fixture-restore note).
  - [x] Knowledge: added testing gotchas to `.knowledge/testing/browser-deep-flow.md`.
  - NOTE: I did NOT add a separate "scalar field save" section to test:db — its phonetic-pilot section
    already drives `save_entry` (the shared helper) end-to-end, and Phases 1–3 each had a live UI edit
    verified (morphology, English gloss on detail, table gloss). A dedicated multi-field block would add
    fixture churn for little extra coverage; revisit if the helper diverges per field.

## Outcome (2026-06-06b) — COMPLETE
All scalar entry/sense edits now flow through the live `DictLiveDb` row (detail: render+mutate+`_save`
via `save_entry`/`save_sense` patch helpers; table + coordinates: `dict_db.*.update({id})`). The
read-model is purely the search/list/SEO index. `operations.ts` is multi-table-only; `clean()` +
`update_entry`/`update_sense` + `SystemInsertFields` are gone; `DictInsertType` is now cast-free.
Green: tsc (0 err / 18 warn, unchanged) · vitest (369) · eslint (0 err / 0 new warn) · `pnpm build` ✔ ·
test:db (16) · test:flow · test:media · test:sync (all PASS).
- `test:sync` (and `dict-sync.mjs` generally) is NOT net-zero — it leaves `e_ja.phonetic=haʔ-SYNC-…`;
  restored manually here. Pre-existing hygiene gap (same shape achi-flow had before this work); fixing
  its net-zero is out of scope (sync-engine test, prior-session domain). Its output also block-buffers
  to the task file (no incremental logs until exit) — don't assume it's hung.
- Fixture left at 13 entries, `e_ja`=`haʔ`. `deletes` table holds a couple benign tombstones from the
  add/delete-sense steps (reference gone test-sense ids; harmless; reappear each test:db/flow run).

### Pre-existing issues flagged (not mine to fix here)
- `.issues/keyman-keyboard-mount-race.md` — `firstElementChild`-on-null race when an edit modal is
  opened+closed faster than the Keyman/IPA keyboard's async setup. Surfaced in the fast table e2e; the
  edit still saves. Unrelated to this migration (fires before the save path).

### Dev/e2e gotchas (also in .knowledge/testing/browser-deep-flow.md)
- Dev OTP `send-code` caps at 10/email/hour (in-memory) → heavy manual re-runs against one email 400.
  Reset by restarting `pnpm dev`; or use a 2nd manager email (diego@livingtongues.org).
- Vite dev cold-start / HMR can `net::ERR_ABORTED` the first `goto` to a route → retry the goto.
- I restarted Jacob's `pnpm dev` (3041) twice: once to reset the OTP counter, once to rebuild the
  damaged achi fixture. A fresh dev server is running in the background now.

## Verification loop
- Dev server: http://localhost:3041 (running). Browser-tools headless Chrome can reach it; Bash curl can't (except status).
- `pnpm -F site test:db` (extend it), `pnpm -F site test:flow`, `pnpm -F site test:media`,
  `pnpm --filter=site check` (0 errors, no new warnings), `pnpm --filter=site test --run`.
- Sync-timing gotchas: `.knowledge/testing/browser-deep-flow.md`.

## Hard rules (don't relearn)
- Never spread/copy live rows (`[...rows]`, `{...row}`, `.map/.filter/.sort`) — breaks reactivity, strips `_save/_reset/_delete`.
- snake_case, options-object args, no bare booleans, no `!`, SQL keywords ALLCAPS, new i18n keys → en.json only.
- Commit only when Jacob says; never push.
