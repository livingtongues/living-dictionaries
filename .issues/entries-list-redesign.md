# Entries list redesign + gloss/definition parity

Master plan (2026-07-24, decisions locked with Jacob). Absorbs the implementation half of
`gloss-definition-display-audit.md` (audit findings live there). Enxet made definitions common
(2,540 definition-only senses) and exposed that `definition` was invisible almost everywhere.

## Locked decisions

- **Definition is first-class** — gloss = short form, definition = long form. Both multilingual
  (MultiString keyed by gloss language). ✅ Entry view already fixed (Sense.svelte per-language
  loop, "(deprecated)" gone, `definition_english` → `definition` enum + en.json key).
- **List row**: definition ALWAYS shows as secondary clamped line (2 lines) when present.
- **Multi-sense**: compact numbered inline "1 hair 2 leaf 3 page…", whole block clamped ~4 lines.
- **No language-name labels** in the list glosses ("English:", "Spanish:" gone); languages
  separated by `·`, intra-language commas kept. Kills the `jewish-neo-aramaic` label hack.
- **Editor media**: NO resting placeholder blocks. One ⋯ button per row → Popover (desktop) /
  drawer (mobile) with Add-or-edit audio / Add photo / Add video. Whole row = drag-drop target on
  desktop (dashed highlight only while dragging).
- **Drop hint** lives in the results-meta header row (next to "Entries: 1-20 / 11935"), editors +
  desktop only — NOT per card. Also: hide the "(26ms)" timing except as tooltip (title attr).
- **Audio ear = listen for everyone** (editors too). Edit audio moves into ⋯. Long-press secret dies.
- **Card style**: `--surface` bg + very subtle border, radius 0.75rem, NO drop-shadow.
- **Telemetry**: new `media_uploaded` event, props `{ media: audio|photo|video, context: list|entry|table }`
  (answers "where do people upload from"; 60d raw retention is enough).
- **Table + print parity** for definition in THIS task. Gallery/OG/homepage cards stay gloss-only
  (short form is right there). CSV already has definition.

## Lanes

### Lane A (lead agent): ListEntry redesign + media UX + telemetry
Files: `entries/list/ListEntry.svelte` + stories, `entries/components/Audio.svelte`,
`entries/+page.svelte` (results-meta hint + ms tooltip), `$lib/components/audio/EditAudio.svelte`,
`$lib/components/image/EditImage.svelte`, `$lib/components/video/AddVideo.svelte`,
`$lib/media/add-media.ts`, `$lib/debug/log-events.ts`.

- ✅ New row layout (play button inline; headword line + alternates; gloss line `·`-joined no
  labels; definition clamped 2 lines; numbered senses clamp-4; def-only senses show definition
  in gloss position; POS/dialects/plural/scientific kept; sd-chips right; photo thumb right
  56px only-when-exists opening viewer; video = small inline chip opening PlayVideo)
- ✅ surface card, subtle border, no shadow; mobile text no longer squeezed
- ✅ Audio click plays for all (context list); recently-updated underline kept
- ✅ ⋯ menu: `Popover.svelte` on desktop, bottom drawer on mobile (check ResponsiveSlideover),
  items: audio (add/edit), photo (add — always addable, photos stack), video (add when none)
- ✅ Row drag-drop (editors, desktop): classify `file.type` → stage into the right modal via new
  optional `initial_file` prop on EditAudio / EditImage / AddVideo (photo modal still requires
  source≥100chars + rights before the staged file uploads — StagedImageThumb exists in ui/)
- ✅ `MEDIA_UPLOADED` in log-events + ALL_TRACKED_EVENTS; `track` fired in `add-media.ts`
  orchestrators (context threaded from callers) + hosted-video insert in AddVideo
- ✅ Drop hint in results-meta row + ms → tooltip (`entries/+page.svelte`)
- ✅ Stories updated for new layout; verify light+dark, 375px + 700px

### Lane B (sol): definitions searchable in Orama
Files: `$lib/search/entries-schema.ts`, `augment-entry-for-search.ts` (+ test),
`search-entries.ts` (+ test), `multilingual-tokenizer` untouched.
- `_definitions: 'string[]'` in schema (all senses, all locales, like `_glosses`)
- augment: `const _definitions = senses.flatMap(s => Object.values(s.definition || {}).filter(Boolean))`
- boost: `_definitions: 1` (below `_glosses: 2`)
- update snapshot tests

#### Lane B notes

- Added `_definitions` to the Orama schema and augmentation across every sense and locale, with
  search boost `1`.
- Added focused augmentation/search coverage and reviewed the expected serialized-index snapshot
  additions. `cd site && pnpm test src/lib/search` passes: 6 files, 27 tests.

### Lane C (sol): table view definition columns
Files: `entries/table/set-up-columns.ts`, `Cell.svelte`, `$lib/utils/default-columns.ts`.
- default_columns: `{ field: 'definition', width: 300 }` after `gloss`
- set-up-columns: expand `definition` per gloss language exactly like the gloss expansion
  (display `${t(gl.bcp)} ${t('entry_field.definition')}`)
- Cell.svelte: `definition` branch = Textbox per bcp, `update_sense({ definition: { ...sense.definition, [bcp]: new_value } })`
  (mirror the gloss branch, optimistic mutate + update)
- GOTCHA: users have persisted column prefs (PersistedState `table_columns` per dict) — an added
  default column won't appear for them. set-up-columns must inject `definition` when missing from
  a stored prefs array (runtime merge, not just new defaults).
- ColumnAdjustSlideover keys `{#each ... (column.field)}` — fine, `definition` is one row pre-expansion.

#### Lane C notes

- Added definition to the default table columns and runtime-injected it after gloss for persisted
  column preferences that predate the new field.
- Definition expands once per gloss language and edits the first sense's multilingual definition
  with the same optimistic update flow as gloss.
- `pnpm check` passes with 0 errors. No existing Cell/full-table svelte-look story was available.

### Lane D (sol): print view definition
Files: `entries/print/print-fields.ts`, `PrintEntry.svelte`, `$lib/types/print-entry.interface.ts`
(+ `PrintFieldCheckboxes.svelte` if it needs a label).
- `_CustomPrintFields`: `definition = 'Definitions'`; `defaultPrintFields.definition: true`
- PrintEntry: after the gloss span, per-sense definition values joined (no labels), italic-safe
- Verify with the print stories/mock-data if present

## Sequencing / conflicts

Lanes B, C, D are file-disjoint from each other and from A → run in parallel. A holds
`en.json` + media modals; C/D must NOT touch en.json (the `entry_field.definition` key already
exists). All lanes: `pnpm test`, `pnpm check`, `pnpm lint` on touched areas; svelte-look stories
for visual surfaces.

## Verification (after merge of lanes)

- ✅ svelte-look: ListEntry stories (incl. CSR EditorMenuOpen) light+dark, 375px + 700px
- ✅ Local variety seeded into the `achi` fixture (`pnpm -F site seed:variety`, 16 demo_* entries)
  → review at http://localhost:3041/achi/entries (log in achi-manager@example.com via dev OTP
  for editor view). Verified headless: list/table/print/entry views, ⋯ menu, drop→staged photo
  modal, play button, and search hits on definition-only entries (clítico → -exma).
- ✅ `pnpm test && pnpm check && pnpm lint` clean (fixed a PRE-EXISTING TZ-dependent EXIF test by
  pinning `process.env.TZ = 'UTC'` in vitest.config.ts; updated the log-analytics snapshot for the
  new media_uploaded event)

## Status

- ✅ Entry view definition first-class (done pre-plan)
- ✅ Stories file expanded to 20 situations (pre-redesign baseline captured)
- ✅ Lane A · ✅ Lane B · ✅ Lane C · ✅ Lane D
- ✅ Jacob review round 1 → Round 2 below

## Round 2 (2026-07-24 review feedback, decisions locked)

Decisions: media rail = full-bleed-when-short / floating-capped-thumb-when-tall (Q1=A, with ⋯
moved LEFT of the media so media owns the card's right edge) · ear inline in headword line only
(Q2=A) · homograph stays data-driven, fix seed realism (Q3=A) · repurpose achi fixture into a
dedicated local-only `dev` dictionary, migrating e2e + seeds (Q4=B, slug `dev`, name "Dev
Playground") · video thumbs by R2 key convention `{key}_thumb.webp` + `video_thumb_src()` with
onerror fallback (Q5=A; `videos.hosted_metadata.thumbnail_url` already exists for hosted videos).

Discovery: NO dev snapshot fallback needed for the local-only dict — anonymous viewers get
pull-only `/changes` backfill from an empty DB when the R2 snapshot 404s (dict-instance.ts
already documents the "dev-only dict absent from prod R2" path).

### R2 Lane 1 — `dev` dictionary ✅
- ✅ `seed-dev-fixture.ts` (`seed:dev-fixture`): catalog row ("Dev Playground", public, es/en,
  orthographies Practical/ipa/script, entry_count stamped — the entries page uses it for
  loading-vs-empty), dev-manager@example.com + manager role, achi.db→dev.db copy, e_ja fixture
- ✅ e2e flows migrated achi→dev (achi-flow renamed dev-flow.mjs; test:flow script updated)
- ✅ variety seed → dev.db: realistic homographs (maha¹/²  only), demo_multi_ortho +
  demo_no_default (alternate-only lexeme), 3 distinct gallery photos (ImageMagick-generated into
  dev-media), video WITH `_thumb.webp` + video WITHOUT (fallback) + hosted YouTube video with
  hosted_metadata.thumbnail_url

### R2 BONUS — cold-boot torn-bundle-read bug (pre-existing, prod-affecting) ✅
Anonymous viewer of a dict with NO R2 snapshot (brand-new dict pre-cron, or the local-only dev
dict) hung on "Loading…" forever, ~2/3 of boots: `read_dict_bundle`'s 20 per-table reads race the
bootstrap `/changes` apply commit → torn bundle → `should_include_tag(undefined)` threw
"Cannot read properties of undefined (reading 'name')" → no Orama watcher, loading=false, dead UI.
Fixed 3 ways (belt+braces):
- `should_include_tag` tolerates undefined; every init_entries junction loop skips missing referents
- entries-ui-store reconciles ONCE after `sync_now()` resolves: total row count vs bundle total →
  full re-read when torn (warm boots no-op); bundle-read failures now log the error message
- dict-session notifies all syncable tables after bootstrap sync (table stores re-query)
Verified: 5/5 cold anonymous boots render at 2s (was ~1/3 flaky).

### R2 Lane 2 — card visuals (ListEntry + Audio) ✅
- ✅ Border off; whole-row hover bg (transition kept); dragging = dashed outline; recently-updated
  = inset bottom box-shadow (no layout shift)
- ✅ Ear inline: absolutely positioned over the headword line (button in `<a>` is invalid HTML,
  so absolute + `.has-audio .headword-line { padding-left }`); shrunk 2.125→1.75rem; following
  lines flush left
- ✅ Media rail flush right: negative margins bleed to top/right/bottom card edges, corners
  clipped by rail radius; `floating` class (row > 104px, measured via `bind:clientHeight`) →
  centered 5.5rem rounded thumbs. GOTCHA: `height:100% + aspect-ratio` CANNOT size a flex
  parent (circular) — flush square width is set explicitly from the measured row height via
  `--flush-thumb-width`
- ✅ ⋯ moved left of the rail; video chip → real thumbnail (`video_thumb_src` + play-triangle
  overlay + onerror fallback chip)
- ✅ Stories: VideoThumbnail, FlushRailShortCard, FloatingRailTallCard (csr, measured);
  EditorMenuOpen selector fixed; real image bytes in `.data/dev-media/demo/…` for stories

### R2 Lane 3 — photo gallery viewer ✅
- ✅ `Image.svelte`: optional `photos` prop → prev/next buttons, ArrowLeft/Right, "2 / 3"
  badge, PER-PHOTO credit + delete (on_delete_image now receives current photo id; live-delete
  clamps index). Wired from ListEntry + EntryMedia. Verified in-browser both places.

### R2 Lane 4 — misc ✅
- ✅ `video_thumb_src()` (+ tests) in media-url.ts
- ✅ Pagination clamp in search(): 0 hits && count>0 && page>1 → snap to last valid page.
  Verified: gallery view toggled on page 2 → URL page param drops, results show.
- ✅ `pnpm test` (1935 ✓) / `tsc` 0 / `lint` clean / `check` 0 errors
- ✅ e2e `dev-flow.mjs` PASS end-to-end (BASE_URL mode); fixed two stale assertions (admin_level
  0-vs-null drift, hardcoded 13-entry count → now DB-driven) + a duplicate-sense fixture bug in
  seed-dev-fixture (only ensures se_ja when e_ja has NO senses)
- ✅ Docs: E2E.md dev-flow section, dev-auth skill "dev fixture dictionary" section,
  `.knowledge/domain/media-serving-urls.md` video-thumbnail convention (generator contract)

### Lane D notes

- Added Definitions as a default-enabled print field, shown only when at least one sense has a
  definition.
- Print entries render definition locales in dictionary gloss-language order, without language
  labels, joined by semicolons immediately after each sense's gloss.

#### Lane A notes (lead)

- ListEntry fully rewritten: surface card (subtle border, no shadow), inline round play button
  (click = listen for everyone; list context in `Audio.svelte` no longer opens the edit modal or
  long-press listens), `·`-joined label-free glosses, definition as clamp-2 secondary line,
  numbered senses (clamp-4, def-only senses stand in for glosses, both = "gloss — definition"),
  video chip + 56px photo thumb + ⋯ button in a right cluster, whole-row drag-drop staging.
- Drag-drop routes by MIME into the right modal via new `initial_file` prop: EditAudio (pre-fills
  `file`), EditImage (staged thumb + upload button gated on source≥100+rights), AddVideo (uploads
  staged file once attribution chosen). `context` prop threads 'list'|'entry'|'table' into
  `add-media.ts`, which now fires `track_media_uploaded` (also fired for hosted-video saves).
- Post-lane fixes: ColumnTitle now honors `column.display` for definition (per-language headers);
  PrintEntry gloss→definition separator ' — '.
- GOTCHAS learned:
  - Visitors fetch dict snapshots from PRODUCTION R2 even in dev (`fetch-snapshot.ts`) — only
    logged-in editors hit the local `/api/dictionary/[id]/db`. Verify local seeds while LOGGED IN.
  - Seeded rows MUST stamp `server_seq` from `server_seq_counter` (see seed-variety-entries.ts)
    or /changes sync silently never delivers them.
  - vitest now pins TZ=UTC (EXIF local-time parsing was machine-TZ-dependent).
