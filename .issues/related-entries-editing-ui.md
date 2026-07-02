# Related entries: human editing UI + help modal — ✅ DONE

API-only relationship authoring (`/api/v1 .../relationships`) got a human UI on the entry detail
page, plus an educational modal explaining relationship types.

Decisions (interview 2026-07-02):
- **Local-first write**: canonicalization (inverse-alias flip / symmetric endpoint sort) extracted
  into shared pure module `$lib/db/relationship-canonicalize.ts`, used by BOTH
  `v1-relationship-write.ts` and the client ops. Client inserts via
  `dict_db.entry_relationships.insert` → sync pushes.
- **Search**: Orama `page.data.search_entries` (warm from `[dictionaryId]/+layout.ts`), 8 results,
  lexeme + first gloss, excludes current entry + already-related.
- **Add flow**: ONE modal (`AddRelatedEntryModal.svelte`) — search/pick target, type select
  (globals + existing custom types; no in-UI custom creation yet), per-type description hint,
  preview sentence ("mbwa — Antonym → paka"), optional note, save.
- **Delete**: × per row (can_edit), `confirm()` prompt.
- **Help**: ? icon next to the "Related entries" label (everyone); `RelationshipTypesInfo.svelte`
  modal lists all global types + descriptions + custom-types note.
- **Empty state**: section shows for editors when empty; hidden for viewers.

## Steps

- ✅ 1. Shared pure module `$lib/db/relationship-canonicalize.ts` (inline vitest); server
  `v1-relationship-write.ts` refactored onto it.
- ✅ 2. `insert_relationship` / `delete_relationship` in `dict-client/operations.ts` +
  `dbOperations` (+ `mocks/db.ts`). Insert resolves type → canonicalizes → natural-key dedupe
  query → insert.
- ✅ 3. en.json: `relationship_type.<slug>_description` ×14 + add/choose_entry/relationship/
  no_matches/remove_confirm/help_intro/custom_types_note.
- ✅ 4. UI: `RelatedEntries.svelte` (can_edit, ? help, per-row ×, add button, empty state; wired
  from `EntryDisplay`), `AddRelatedEntryModal.svelte`, `RelationshipTypesInfo.svelte`.
- ✅ 5. Stories for all three (RelatedEntries Editor/EmptyEditor; modal search + preview states);
  svelte-look screenshots verified.
- ✅ 6. Verified: full `pnpm test` (1043 passed), `pnpm check` 0 errors, eslint clean (1 benign
  require-atomic-updates warning), headless-browser e2e on dev 3041 (auth → help modal → add
  antonym mbwa↔paka with note → inverse view on paka → confirm-delete → row gone, synced to
  server DB both ways).
- ✅ 7. `.knowledge/domain/related-entries-model.md` Surfaces updated.

## Bug found & fixed along the way
Local dev dict DBs (and any dev-window browser client) had recorded a **draft** of
`20260701b_entry_relationships.sql` as applied — missing the `process_delete_cascade`
re-declaration, so relationship deletes tombstoned but the row survived (and became permanently
undeletable due to `INSERT OR IGNORE`). Added fix-forward
`20260702_relationship_delete_cascade_repair.sql` (re-declares trigger + sweeps already-tombstoned
rows). Lesson recorded in `.knowledge/migration/adding-a-syncable-dict-table.md` ("stale-draft
trap").

## Deliberate follow-ups (not planned, just noted)
- In-UI custom relationship-type creation (write-in, optional inverse label).
- Sense-level narrowing in the UI (API already supports it).
- Relationship visibility in list/gallery/print/table + Orama.
