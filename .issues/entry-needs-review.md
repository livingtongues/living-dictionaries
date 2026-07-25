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
- ✅ Enxet import ran with `review` populated; the follow-up audit below then
      rewrote 317 actionable reviews and removed 181 stale ones.

## Notes
- Horse `<Followup>` rendering bug (nested question answers) delegated to a spawned Opus horse
  session (`d4eade6f`) → `~/code/horse/.issues/followup-rendering-bug.md`.

## Follow-up — write for the human reviewer, not the importing agent (2026-07-24)

Jacob reviewed the production Enxet banners and found that the current notes mix
three different concerns into one programmer-facing sentence:

1. the human review task;
2. the importer's implementation terminology (`glosses.gn`, "record boundary");
3. the agent traceback (`source l. 15873`).

The reviewer only has the entry page in front of them. The banner must contain
enough plain-language information to make the decision there; it must not tell a
human to open or parse the source file. Source provenance should be a separate,
structured, visually secondary line for a future agent.

### Code/data audit

- The category chip currently renders the raw free-string key, so
  `language_split` / `dropped_text` leak programmer-style underscores. The
  entries-list facet already humanizes underscores; the banner does not.
- `EntryReview` is currently `{ category, note }`. Every imported Enxet entry
  already has structured entry-level `citations: [{ slug: "enxet-lexicon",
  locator: "l. …" }]`, so the banner can render the requested source line from
  existing normalized provenance instead of duplicating it inside `review`.
- All 498 Enxet notes use agent-oriented templates containing source line
  numbers and verbs such as "verify against the source", "inspect", or
  "compare". The 43 language-split notes additionally expose the storage field
  name `glosses.gn`.
- The 38 `dropped_text` entries reveal a deeper stale-flag problem. Those flags
  were assigned before the parser recovered 35 headwords whose `\lx` marker was
  missing. In final staging, 36 of the 38 entries have no other review finding
  and no longer need human review at all; 4 entries retain a different valid
  concern after removing the obsolete flag. Keeping these banners would ask a
  human to verify an already-resolved parser repair.
- Removing only the stale `stray_text_dropped` concern changes the Enxet queue
  from 498 to **462** entries:
  - `truncated` 200
  - `headword_in_gloss` 141
  - `language_split` 43
  - `other` 33
  - `uncertain_plural` 29
  - `missing_gloss` 16

### Initial direction before the full 498-item audit (superseded where noted below)

- Keep stable category keys in data/search, but display them as human labels
  (`language split`, `headword in gloss`).
- Keep `review.note` exclusively human-facing: plain language, explicit
  before/after values, and a concrete question/action. It may name "Sense 2"
  when needed, but never a source line, JSON/database field, or instruction to
  inspect the source.
- Render a separate subdued source line from `entry.main.citations`, e.g.
  `Source: enxet-lexicon · line 15,873`. This keeps one source of truth and is
  still available to agents through the existing v1 `entry.main.citations`.
- Rewrite Enxet's review metadata only through the v1 PATCH API after a generated
  all-notes preview is approved. Do not alter headwords, senses, translations,
  notes, homographs, or other imported linguistic content.
- Remove the 36 reviews that are now purely stale; preserve and rewrite the
  other 462. Back up first, use a payload-hash-bound resumable patch ledger, and
  verify exact live category counts + authenticated browser rendering.
- Update the OpenAPI descriptions and importing guide with the reviewer-writing
  contract so future agents do not repeat the mistake.

### Jacob's decisions

- ✅ Rewrite Enxet's existing review metadata and remove reviews made obsolete
  by the parser repair.
- ✅ Human instructions use plain English; Spanish/Guaraní data values remain
  verbatim.
- ✅ Source provenance uses the entry's existing structured citation and is
  hidden behind a collapsed `Source details` disclosure.
- ✅ Manually review all 498 current Enxet review items against the staged raw
  text + final fields before changing production. Do not treat a category-wide
  template substitution as review.
- ✅ Strengthen the API import Phase 1 instructions with the full human-review
  contract established here.

### Manual audit result

- ✅ Read all **498** current review items against the staged verbatim value and
  final imported translation/definition/Guaraní/plural/Notes fields.
- **317 remain actionable and are rewritten; 181 are removed.** Final categories:
  - `truncated`: 100
  - `headword_in_gloss`: 97
  - `other`: 44
  - `language_split`: 42
  - `missing_gloss`: 20
  - `uncertain_plural`: 14
- The removals are not blanket category deletion:
  - 35 obsolete lost-`\lx` / stray-tail records after the headword recovery;
  - 15 `pl` flags that were grammatical information already preserved in Notes,
    not missing plural forms;
  - values that merely mention Guaraní rather than contain a Guaraní translation;
  - expected names/ethnonyms/comparisons left intact with no import decision;
  - complete literal explanations and explicitly labelled Guaraní values that had
    been falsely classified as truncated.
- Three dropped-text cases remain real and now explain the complete human task:
  `Áye’` (`apye’` omitted and not recovered elsewhere), `Másse apto` (literal
  split left malformed visible text), and `Yakwátam’ák` (`Yalaqe’` may be an
  untranslated missing entry).
- The audit found additional bespoke problems hidden by category templates:
  `Leklek` has recoverable “lechuzón de campos” vs imported “lechuzón de cam”;
  `Nennaqsapma` imported a longer translation than its staged “tragar”; `Sawo
  pakxak` has contradictory comparison names in definition vs Notes; several
  literal/Guaraní splits left dangling punctuation or words.
- Audit artifacts:
  - `/tmp/enxet-import/review-human-final-audit.json` — all 498, each marked
    manually reviewed with keep/rewrite/remove decision and reason.
  - `/tmp/enxet-import/review-final.json` — the 317 final API review objects,
    keyed by stable entry UUID.
  - Final regenerated payload SHA-256:
    `f4e268d1b8b6ca0461d3d5a872b53e60e933061fc4a8b4ab326c0ded79db14a2`.
    A structural diff proves all 11,969 entries' non-review data is unchanged.

### Follow-up implementation (complete)

- ✅ Review category keys now have centralized human labels (including
  `headword_in_gloss` → “Enxet text in Spanish” and `truncated` → “Possibly
  incomplete”) in both the entry banner and review facet.
- ✅ `ReviewBanner` receives the entry's existing citations and renders them
  under a collapsed **Source details** disclosure.
- ✅ Banner/filter strings are present in the English i18n catalog rather than
  existing only as code fallbacks.
- ✅ Phase 1 + Phase 2 importing guidance, OpenAPI, and TS docs now define the
  self-contained human-note contract and explicitly separate citations.
- ✅ Verification:
  - full Vitest suite: 1,978 passed / 3 skipped;
  - `tsc`, ESLint, and `svelte-check` clean (46 pre-existing Svelte warnings);
  - svelte-look stories checked in light/dark at desktop and 360px, including
    expanded Source details and long notes;
  - `svelte-fix` reports no component issues.
- ✅ Fresh online pre-patch backup:
  `/opt/hosting/data/.import-backups/enxet-pre-review-rewrite-20260724T143539Z.db`
  (20,131,840 bytes; integrity `ok`; 11,969 entries / 498 reviews; SHA-256
  `67459acea183178eb064a13883954d56b580edfbb2b6096bbe7ea82184fb8d7e`).
- ✅ Patched all 498 existing review fields through the deployed v1 API with a
  resumable hash-bound ledger and GET-before-PATCH conflict protection:
  **317 rewritten, 181 cleared, 0 failures/conflicts**. Every resulting value
  was read back through the API and compared exactly. Ledger:
  `/tmp/enxet-import/review-patch-ledger.json`.
- ✅ Independent production DB verification: integrity `ok`; 11,969 entries;
  exactly 317 reviews with the six expected category counts.
- ✅ Authenticated production-browser verification as a real Enxet manager:
  exact rewritten notes rendered for `Áye’` and `Hem askok`, the stale banner
  was absent for `Ekpayhegwe egwáxok`, and the queue returned exactly 317.
  No page/console errors or horizontal overflow.
