# M2b — Seed dummy entries + deep interaction test

Resolves the P5 `0 / 8` finding (stub seeded dictionaries but no entries) and exercises the
manager (`achi`) edit UI in a real browser against the production `node build`.

## Files changed
- **`site/src/lib/mocks/dummy-entries.ts`** (new) — realistic Achi dummy data, typed against the
  generated `Tables<…>` rows so it can't drift:
  - 13 `entries` (lexeme jsonb `{default}`, phonetic, a couple with `notes`)
  - 14 `senses` (one entry has 2 senses) with `glosses` `{en, es}`, `parts_of_speech`,
    `semantic_domains`
  - 2 `speakers`, 2 `audio` + 2 `audio_speakers`
  - 2 `tags` + 3 `entry_tags`, 2 `dialects` + 2 `entry_dialects`
  - All rows tagged `dictionary_id: 'achi'`; `deleted: null` so the worker's
    `.is('deleted', null)` filter passes.
- **`site/src/lib/supabase/stub-client.ts`** — (1) import + register the new arrays in `dummy_data`
  (`entries/senses/audio/speakers/tags/dialects` + `audio_speakers/entry_tags/entry_dialects`).
  (2) **Stretch: writes now mutate `dummy_data`** — `insert/upsert/update/delete` apply to the
  in-memory arrays (upsert matches by `id`; update/delete honor the `eq/…` filters) and `resolve()`
  returns the affected rows so `.select().single()` callers get their inserted/updated row instead
  of `null`.
- **`site/src/lib/mocks/dummy-dictionaries.ts`** — achi `gloss_languages: ['en', 'es']` so the
  Spanish gloss shows in the list/editor/settings.

## How the data reaches the UI
Search worker (`entry.worker.ts` → `init_entries`, `can_edit=true` for the manager) calls
`cached_data_table({ table, dictionary_id:'achi', … })` → stub `from(table).select().eq(
'dictionary_id','achi')` returns the seeded rows → worker builds the Orama index and the
`entries_data` store. Edits go through `supabase/operations.ts`, which (a) optimistically updates
the worker's in-memory state + Orama index (drives the visible UI instantly) and (b) writes to the
stub (now a real in-memory mutation).

> Note: `load_cache()` still fetches the real CDN `entries_data/achi.json` first, but for a manager
> (`can_edit`) the worker continues past that and the final `set_entries_data` + `create_index`
> (which does `orama_index = { [id]: index }`, a replace) overwrite it with the seeded data — so the
> dummy entries win. The CDN fetch only happens because the test browser has network.

## Interactions verified (browser-tools / CDP on `node build` :3094, manager mock)
| # | Check | Result |
|---|---|---|
| 1 | `/achi/entries` list | ✅ **1-13 / 13** — lexeme + phonetic, POS, en/es glosses, semantic-domain tags, dialect chips, Listen (audio) |
| 2 | Click entry → overlay Modal | ✅ opens at `/achi/entry/e_ja`, **grey backdrop visible**, full editor |
| 3 | Click Phonetic field → EditFieldModal | ✅ text input prefilled `haʔ` + **IPA keyboard grid** (tbody-nesting fix holds) |
| 3b | Edit + Save the field | ✅ phonetic updates to **`[haʔ-EDITED]`** in the UI (full round-trip) |
| 4a | Add Sense | ✅ **Sense 2** appears with empty gloss/POS/domain fields |
| 4b | Delete Sense (✕) | ✅ back to 1 sense; Sense 1 (water/agua) intact |
| 5 | Filters slideover | ✅ typo-tolerance slider + POS facets (noun 10 / adjective 3) + semantic-domain facets with counts |
| 5b | List / Table / Gallery toggles | ✅ all render; Table shows Lexeme/audio/photo/EN/ES columns; Gallery empty (no dummy photos — expected) |
| 6 | `/achi/settings` | ✅ name, ISO, glottocode (achi1257), gloss langs **English + Spanish**, Save buttons, BadgeArray |
| 6b | other manager pages | ✅ `/achi/{about,contributors,export,import,history,grammar}` all 200; export shows **Audio (2) / Images (0)**; history "No history yet" |

No Svelte-5 regressions or SSR 500s surfaced. Server log clean. Nothing broken needed fixing.

## Screenshots taken (CDP, viewport)
Entries list · entry overlay (ja') · EditFieldModal IPA keyboard · edited phonetic detail ·
Sense 2 added · Filters slideover · Table view · Gallery (empty) · Settings. Captured to
`/tmp/claude-1000/browser-screenshot.png` (overwritten each shot — not persisted).

## Verify (all green)
- `pnpm --filter=site check` → **0 errors**, 484 warnings (expected Svelte-5 legacy deprecations).
- `pnpm --filter=site test --run` → **123 pass** (30 files).
- `pnpm --filter=site build` → ✔ (only benign vendor circular-dep warnings); `node build` boots,
  `/ /achi /achi/entries /achi/entry/e_ja /achi/settings` all 200.
- `eslint` on the 3 changed files → clean.

## For Jacob to eyeball
- On :3041, hard-refresh `/achi/entries` — should now show **13 entries** (mock manager). If your
  browser still has cached real achi data in idb, hit **Reset Cache** once.
- Minor (not a bug): Gallery view shows "0 / 8" because none of the 13 dummy entries have photos
  (gallery filters to image-bearing entries). The "8" is gallery's per-page size. Seed photos later
  if you want a populated gallery (needs real `serving_url`s).
- `import`/`history` pages don't set a `<title>` (pre-existing, page-level — left as-is).

## Not committed (per instructions). Changes left in the working tree.
