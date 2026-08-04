# Entries table design audit + redesign

First design audit of the `/[dictionaryId]/entries` table view. Jacob-approved decisions are
FINAL below — don't re-ask.

Files: `site/src/routes/[dictionaryId]/entries/table/` (EntriesTable, Cell, ColumnTitle,
ColumnAdjustSlideover, set-up-columns, cells/*) + `$lib/utils/default-columns.ts` + persisted
`preferred_table_columns` (`table_columns_03.18.2024-{user}` PersistedState in `+layout.ts`).

## Decisions (Jacob, 2026-08-04)

- **Row density**: comfortable ~48px rows; photo thumbs FULL cell height, edge-to-edge, NO
  rounded corners (flush, like the list rail squares).
- **Row-per-sense**: YES — merged entry cells SPANNING sense rows (real `rowspan` on
  entry-level columns: checkbox, lexeme, audio, speaker, phonetic, morphology, notes, sources,
  homograph, coordinates, elicitation_id, interlinearization, linguistic_history,
  scientific_names, citations…). Sense-level columns (photo, gloss, definition, POS, domains,
  noun_class, plural_form, variant, example sentence, sense-sources) get one row per sense,
  dashed inner dividers, small sense-number badge, "+ add sense" affordance in the merged region.
- **Editing per cell type**:
  - Keep MODAL (Keyman/IPA/Markdown): lexeme, local_orthography, gloss, definition,
    example_sentence, phonetic, notes, linguistic_history, plural_form (also MOVE plural_form
    into EditField's Keyman branch — it's vernacular but currently plain input).
  - IN-PLACE cell editor (Enter save / Esc cancel): morphology, interlinearization,
    elicitation_id, noun_class, scientific_names, variant, homograph.
  - Pickers/modals stay for POS, domains, dialects, tags, sources, speaker, media.
  - coordinates = map-pin icon cell → reuse entry page `GeoTaggingModal`.
  - Stretch: modal "save ↓ next row" (same field next row) for column runs.
- **Header click (desktop)**: per-column popover — Hide, Pin, Reset width, "All columns…" →
  slideover. Drag border = resize (6px zone, dbl-click reset); drag body = reorder (4px lift
  threshold, ghost + drop line; gloss-group moves as unit; lexeme locked first).
- **Mobile**: slideover stays the arrange menu — touch drag-handle reorder (replace chevrons),
  inline px readout (kill toast), visible "Columns" toolbar button.
- **New columns**: homograph, video, citations + per-sense sources, coordinates, variant.
  Variant is data-driven for ALL dicts but `hidden: true` by default EXCEPT the two old
  `DICTIONARIES_WITH_VARIANTS` dicts (then delete the hardcoded pushed-column hack).
- **Bulk selection**: leftmost sticky checkbox micro-column, one per ENTRY (spans sense rows).
  In-memory per-dict basket of entry ids; survives search/filter/paging. Floating bar:
  "N selected · View selected · Clear" + actions: delete, ±tag, ±dialect, add source,
  set/clear review flag. Stretch: export-selected CSV, print selected. Sense-level bulk ops
  deferred.
- **Sorting**: DEFERRED (Orama relevance + pagination; page-only sort would mislead).
- **Video no-thumb**: compact chip fallback (thumbs ARE auto-generated shortly after save via
  `/api/video/generate-thumbnail` + weekly sweep self-heal, so chip = transient/legacy only).
  Same fix in ListEntry (the "water card" emptiness).
- **z-index**: explicit ladder — cells < sticky col < sticky header < corner; `isolation:
  isolate` on cells so no content (imgs/checkboxes/badges) climbs the sticky chrome. Verify
  with scrolled screenshots both axes.
- **Column prefs cache key**: ONE rename at the very end (resets user prefs once) —
  fold all default-width/new-column changes into it.

## ✅ Shipped (2026-08-04)

- ✅ `table-wrap` fixed height → `max-height` (no more phantom empty box / "cut off" look)
- ✅ sources-row `--col-width: auto` applied to every cell in the row → sources cell only
- ✅ `Waveform` play button egg → perfect 3rem circle (svelte-look verified light+dark)

## Audit reference

Bugs to fix in phase 2: notes/linguistic_history/plural_form can't be cleared + MultiString
`{ default }` clobbers other locales; scientific_names `[value]` clobbers array; photo cell
broken-img alt flash (no fallback); example-sentence translation cell raw `alert()`;
multi-audio ordinal badge clips at 31px col; `Sompeng` class + garifuna/jewish-neo-aramaic
hacks noted (list view, out of scope).

Missing-fields report (now being added): homograph, variant, video, citations + sense sources,
coordinates. Coverage ceilings resolved by row-per-sense (photo/gloss/etc per sense); audio
stays first-audio + EntryAudioControl chooser; scientific names editing must preserve array.

Keyman fact: EditField wraps gloss/definition/example_sentence in per-bcp Keyman; lexeme/
local_orthography/linguistic_history with keyboard chooser; phonetic = IPA keyboard; notes =
Markdown + Keyman. Plain-input branch = the in-place candidates listed above.

## Phases

1. ✅ Quick fixes
2. ✅ Cell correctness: clearable + locale-preserving MultiString writes (`merged_default` in
   Cell.svelte), scientific_names array preserve, Image.svelte thumb error fallback (camera
   icon + bg, used by table/list/gallery), alert() → striped `.needs-sentence-first` cell +
   `entry.add_example_sentence_first` EN key, plural_form moved into EditField's Keyman branch
3. ✅ Structural redesign: row-per-sense (tbody per entry, real `rowspan` on entry-level cells,
   `sense-fields.ts` defines the split), 48px min rows, flush full-height photo thumbs
   (square=112), 2-line clamp on text cells, sense-number badges, "+ add sense" in lexeme cell,
   hover-revealed `.empty-affordance` icons (`@media (hover: hover)`, always-on for touch),
   z-index ladder (isolated cells 0 < sticky col 10 < header 20 < corner 30) verified on both
   scroll axes + dark mode, new columns: homograph/video (VideoCell)/coordinates
   (CoordinatesCell → GeoTaggingModal)/sense_sources + citations on the sources cell, variant
   data-driven (default-shown only for `DICTIONARIES_WITH_VARIANTS`, injected for pre-rename
   prefs; the old hardcoded push deleted), `AddVideo` gained `sense_id` prop. Latent bug found:
   old variant column had NO Cell branch (rendered blank forever) — fixed.
4. ✅ Desktop drag: border-drag resize (8px handle, dbl-click reset, min 31/max 800), body-drag
   reorder (4px lift, dimmed header + drop line, gloss-groups move as one, lexeme locked at 0;
   math + tests in `column-drag.ts`), plain click → per-column Popover menu (Hide/Pin[first
   col]/Reset width/All columns…). Coarse pointers keep tap → slideover.
5. ✅ Mobile: ColumnAdjustSlideover revamp — pointer drag-handle reorder (replaces chevrons),
   inline px readout (toast deleted), `selectedColumn` now optional; floating `.columns-button`
   (visible only `@media (hover: none)`) opens it from the table.
6. ✅ Bulk selection: `entry-selection.svelte.ts` (per-dict module-scope basket, SvelteSet —
   NOTE: create via plain const, NOT $derived → `state_unsafe_mutation`), checkbox column
   (sticky, 32px, one per entry spanning senses, select-all header), `BulkActionBar.svelte`
   (fixed bottom pill: N selected · View selected [renders basket from `$entries_data` even
   off-search] · Tags ± incl. create-new · Dialects ± · Sources + · Review set/clear · Delete).
   Junction link/unlink verified idempotent, so bulk ± needs no state reads.
7. ✅ In-place editing: Textbox `inline` prop (click → in-cell input, Enter/blur commit, Esc
   cancel) for morphology, interlinearization, elicitation_id, noun_class, scientific_names,
   variant, homograph. Keyman/IPA/Markdown fields keep the modal.
8. ✅ Cache-key rename → `table_columns_2026-08-04` (+ testing knowledge note on headless
   hover emulation).

All verified in-browser against the dev playground (desktop 1440 w/ blink-settings hover flags,
mobile 390 default headless, dark via CDP prefers-color-scheme), `pnpm check` 0 errors, table
folder lint clean, full `pnpm test` 2595 passed.

## Remaining follow-ups (small)

- ✅ "Save ↓ next row" — shipped (see session log).
- `EntriesTable.stories.ts` svelte-look story (needs page_data mocks: writes/dict_db/
  entries_data — see `.knowledge/testing/svelte-look-page-stories.md`).
- Bulk stretch: export-selected CSV, print selected.
- ✅ ColumnTitle video/coordinates header icons (bi/camera-video + mdi/map-marker, verbose
  labels in the slideover).
- Consider extracting the audio pencil + photo/video add into hover affordances on mobile UX
  review feedback.

## Session log

- 2026-08-04: audit + decisions + quick fixes shipped.
- 2026-08-04 (cont.): phases 2–8 all implemented + verified. Only the follow-ups above remain.
- 2026-08-04 (cont. 2): "Save ↓ next row" column runs shipped: `table/column-run.svelte.ts`
  shared cursor (1s self-expiring target so a run dying on a needs-sentence-first cell can't
  fire a modal later) → Textbox `run_cell_id`/`next_run_cell_id` props auto-open the target
  cell (modal, or inline editor for inline fields) + scrollIntoView; ids computed in Cell
  (`field|bcp|orthography_code|row_id`, sense rows for SENSE_FIELDS, next rows wired in
  EntriesTable — sense columns walk sense rows across entries, entry columns walk entries).
  EditField/EditFieldModal gained optional `on_save_next`: ghost "Save ⌄" button + Ctrl/Cmd+Enter
  (`svelte:window`, works from ProseMirror too); inline editors also do Ctrl+Enter → commit +
  hop down. Fixed pre-existing crash: EditField `save()` did `value.trim()` on a null-valued
  field (phonetic branch never binds inputEl) → `value || ''`. Header icons for video/
  coordinates added in ColumnTitle. Verified headless (notes run via button, phonetic run via
  Ctrl+Enter, persistence in row 1, empty next-row modal, zero pageerrors); `pnpm check` 0
  errors, lint clean, full suite passed pre-change (only EditField null-guard after).
