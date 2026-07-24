# Entry "needs review" field — editor-only review queue for imports

Born from the Enxet import (`.issues/enxet-import.md`): imports (and humans) need to flag
entries a reviewer should check, **without showing the public**, with a **bespoke explanation**
of what to check. ~482 Enxet entries (~4%) carry review-worthy findings across ~7 categories
(truncated-in-source, headword-in-gloss, guaraní-split, plural-uncertain, dropped-text,
no-gloss, misc).

## Decisions (Jacob, locked)

- **Mechanism:** a first-class **editor-only `review` field on `entries`** = `{ category, note }`
  (NOT tags — tags can't hold the bespoke note). Category is a **free string** (found-or-created,
  like tags) so future imports aren't constrained; it drives a filter facet. Note = the specific
  "what to check" (markdown-ish plain text; may enumerate senses).
- **Granularity:** entry-level (one `review` per entry). ~most flagged entries have one flagged
  sense; the note enumerates senses when needed.
- **Visibility:** **filter at render**, same bar as `private` tags — the value syncs in the public
  snapshot but is never displayed/searched for non-editors (gated on `can_edit`, NOT admin_level).
- **Also (Q2):** fix `private`-tag visibility so `private` means **editor-visible** (managers +
  contributors), not just site admins. Today `should_include_tag(tag, admin_level)` hides private
  tags from a plain manager (`admin_level 0`) — a latent bug for a manager reviewing their own dict.
- **Sequencing (Q3):** build the field FIRST, then run the Enxet import once with review notes
  populated (import maps each flag → `{ category, note }`).

## Implementation checklist — ✅ ALL DONE (verified)

### Schema + migration
- ✅ `dictionary.types.ts`: `EntryReview { category: string, note: string }`.
- ✅ `dictionary.ts`: `review: text({ mode: 'json' }).$type<EntryReview>()` on `entries`.
- ✅ Migration `dictionary-migrations/20260724b_entry_review.sql` (`ALTER TABLE entries ADD COLUMN review TEXT`).
      Auto-globbed on client+server. Sorts after `20260724_photo_exif_coords`; a concurrent media-WIP
      agent added `20260724c_drop_photo_serving_url` — different table, no conflict.
- ✅ `dictionary-json-columns.ts` test: `review` added to expected `entries` JSON columns.

### Editor gating (filter-at-render) + private-tag fix
- ✅ `tag/visibility.ts`: `should_include_tag(tag, { admin_level, can_edit })` — private visible when
      `admin_level >= 1 || can_edit`. Inline test added. All callers updated.
- ✅ `assemble-entry-data.ts`: accepts `can_edit`; strips `main.review` unless editor; passes `can_edit`
      to `should_include_tag`. Tests added.
- ✅ `build-entry-data.ts` (SSR): threads `can_edit`. SSR entry endpoint resolves role→can_edit; v1
      GET/PATCH pass `can_edit: true` (API key = editor).
- ✅ `entry.worker.ts`: stores `can_edit`; passes to `assemble_entry_data` + both `should_include_tag`
      call sites. (`can_edit` was already plumbed store→worker, just unused.)

### Entry type
- ✅ `entry.interface.ts`: `review` added to `main` as `& Partial<Pick<…,'review'>>` (OPTIONAL — absent for non-editors).

### Search facet (editor-only via stripped data)
- ✅ `entries-schema.ts` / `augment-entry-for-search.ts` / `search-entries.ts` / `types.ts`:
      `has_review` + `_review_categories` facets + where clauses + QueryParams. Snapshots updated.
- ✅ `EntryFilters.svelte`: "Needs review" toggle + category FilterList, gated on `page.data.can_edit`.

### Entry page UI
- ✅ Extracted `$lib/components/entry/ReviewBanner.svelte` (+ story, screenshot-verified light+dark).
      `EntryDisplay.svelte` renders it only when `can_edit && fields.review`; Resolve → `save_entry({ review: null })`.

### v1 API (human/agent parity)
- ✅ `entry-input.ts`: `review?: EntryReview | null` on EntryInput + EntryPatch; `to_review()` + inline test.
- ✅ `v1-entry-write.ts`: mapped in create (`build_entry`) + patch (`build_entry_patch_row`, `null` clears). Tests added.
- ✅ `openapi.ts`: `EntryReview` component + on EntryInput/EntryPatch/EntryMain; openapi.test keys updated.
- ✅ importing.md guide: §2.3 review-field + category vocabulary; §1.3 flags→categories link.

### Verify
- ✅ `pnpm test`: 1952 passed, 0 failed tests (the 1 failed FILE = `map-static` `$env/static/public`
      harness quirk, untouched/unrelated). `tsc`: only the concurrent media-WIP `serving_url` errors.
      `eslint`: 0 errors. `svelte-check`: clean for my components.
- ✅ svelte-look screenshots of the banner (light+dark, all flavors).
- [ ] NEXT: run Enxet import with `review` populated per flag→category (tracked in enxet-import.md).

## Notes
- Horse `<Followup>` rendering bug (nested question answers) delegated to a spawned Opus horse
  session (`d4eade6f`) → `~/code/horse/.issues/followup-rendering-bug.md`.
